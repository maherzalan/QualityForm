/**
 * دوال حفظ وجلب التقارير (مع RLS حسب الصلاحية)
 */
(function () {
    'use strict';

    const REPORT_LIST_FIELDS = 'id, user_id, center_name, region, specialist_name, visit_date, entry_date, overall_rating, staff_count, student_count, attendance_rate, period_start, period_end, continue_support, created_at';

    async function mapReportRow(data, userId) {
        const regionId = typeof resolveRegionId === 'function' ? await resolveRegionId(data.region) : null;
        return {
            user_id: userId,
            center_name: data.centerName,
            region: data.region,
            region_id: regionId,
            region_other: data.regionOther || null,
            job_title: data.jobTitle,
            job_title_other: data.jobTitleOther || null,
            specialist_name: data.specialistName,
            visit_period: data.visitPeriod,
            visit_date: data.entryDate,
            entry_date: data.entryDate || null,
            staff_count: parseInt(data.staffCount, 10) || 0,
            student_count: parseInt(data.studentCount, 10) || 0,
            attendance_rate: data.attendanceRate === '' ? 0 : parseFloat(data.attendanceRate) || 0,
            classrooms_count: parseInt(data.classroomsCount, 10) || 0,
            tents_count: parseInt(data.tentsCount, 10) || 0,
            challenges_notes: data.challengesNotes || null,
            overall_rating: data.overallRating ? parseInt(data.overallRating, 10) : null,
            continue_support: data.continueSupport || null,
            final_notes: data.finalNotes || null,
            period_start: data.periodStart || null,
            period_end: data.periodEnd || null
        };
    }

    async function insertChildRows(reportId, table, rows) {
        if (!rows?.length) return;
        const { error } = await getSupabase().from(table).insert(rows.map(row => ({ ...row, report_id: reportId })));
        if (error) throw error;
    }

    async function saveCompleteReport(formData) {
        const user = window.currentUser;
        if (!user) throw new Error('يرجى تسجيل الدخول أولاً');

        const { data: report, error: reportError } = await getSupabase()
            .from('reports')
            .insert(await mapReportRow(formData, user.id))
            .select()
            .single();

        if (reportError) throw reportError;

        await Promise.all([
            insertChildRows(report.id, 'challenges', formData.challenges.map(c => ({
                description: c.text,
                percentage: c.percent === '' ? null : parseFloat(c.percent)
            }))),
            insertChildRows(report.id, 'security_risks', formData.securityRisks.map(r => ({
                risk_type: r.type,
                description: r.desc
            }))),
            insertChildRows(report.id, 'strategies', formData.strategies.map(s => ({
                strategy_type: s.type,
                description: s.description
            }))),
            insertChildRows(report.id, 'competitions', formData.competitions.map(c => ({
                name: c.name,
                details: c.details || null
            }))),
            insertChildRows(report.id, 'community_participations', formData.communityParticipations.map(c => ({
                participation_type: c.type,
                outcomes: c.outcomes || null
            }))),
            insertChildRows(report.id, 'initiatives', formData.initiatives.map(i => ({
                name: i.name,
                description: i.description || null
            }))),
            insertChildRows(report.id, 'success_stories', formData.successStories.map(s => ({
                title: s.name,
                challenge: s.challenge,
                solution: s.solution,
                impact: s.impact
            }))),
            insertChildRows(report.id, 'recommendations', [
                ...formData.urgentRecommendations.map(text => ({ type: 'urgent', text })),
                ...formData.mediumRecommendations.map(text => ({ type: 'medium', text })),
                ...formData.strategicSolutions.map(text => ({ type: 'strategic', text }))
            ])
        ]);

        return report;
    }

    async function updateReport(reportId, formData) {
        if (!window.currentUser) throw new Error('يرجى تسجيل الدخول');
        const row = await mapReportRow(formData, window.currentUser.id);
        delete row.user_id;
        const { data, error } = await getSupabase().from('reports').update(row).eq('id', reportId).select().single();
        if (error) throw error;
        if (typeof logActivity === 'function') await logActivity('update_report', { reportId });
        return data;
    }

    function applyReportFilters(query, filters = {}) {
        let q = query;
        if (filters.region) q = q.eq('region', filters.region);
        if (filters.centerName) q = q.ilike('center_name', `%${filters.centerName}%`);
        if (filters.rating) q = q.eq('overall_rating', parseInt(filters.rating, 10));
        if (filters.dateFrom) q = q.gte('visit_date', filters.dateFrom);
        if (filters.dateTo) q = q.lte('visit_date', filters.dateTo);
        if (filters.continueSupport) q = q.eq('continue_support', filters.continueSupport);
        return q;
    }

    async function fetchAccessibleReports(filters = {}) {
        const user = window.currentUser;
        if (!user) return [];

        let query = getSupabase()
            .from('reports')
            .select(REPORT_LIST_FIELDS)
            .order('created_at', { ascending: false });

        if (filters._ownerOnly) query = query.eq('user_id', filters._ownerOnly);

        query = applyReportFilters(query, filters);

        const { data, error } = await query;
        if (error) throw error;
        return data || [];
    }

    async function fetchUserReports(filters = {}) {
        return fetchAccessibleReports(filters);
    }

    async function fetchReportChildren(reportId) {
        const tables = [
            ['challenges', 'challenges'],
            ['security_risks', 'security_risks'],
            ['strategies', 'strategies'],
            ['competitions', 'competitions'],
            ['community_participations', 'community_participations'],
            ['initiatives', 'initiatives'],
            ['success_stories', 'success_stories'],
            ['recommendations', 'recommendations']
        ];

        const results = await Promise.all(
            tables.map(async ([key, table]) => {
                const { data, error } = await getSupabase().from(table).select('*').eq('report_id', reportId);
                if (error) throw error;
                return [key, data || []];
            })
        );

        return Object.fromEntries(results);
    }

    async function fetchReportById(reportId) {
        if (!window.currentUser) throw new Error('يرجى تسجيل الدخول أولاً');

        const { data: report, error: reportError } = await getSupabase()
            .from('reports')
            .select('*')
            .eq('id', reportId)
            .single();

        if (reportError) throw reportError;

        const children = await fetchReportChildren(reportId);
        return { report, ...children };
    }

    async function deleteReport(reportId) {
        if (!window.currentUser) throw new Error('يرجى تسجيل الدخول أولاً');

        const { error } = await getSupabase()
            .from('reports')
            .delete()
            .eq('id', reportId);

        if (error) throw error;
        return true;
    }

    async function fetchReportStats(filters = {}) {
        const reports = await fetchAccessibleReports(filters);
        const total = reports.length;
        const avgRating = total
            ? (reports.reduce((s, r) => s + (r.overall_rating || 0), 0) / total).toFixed(1)
            : 0;
        const avgAttendance = total
            ? (reports.reduce((s, r) => s + (parseFloat(r.attendance_rate) || 0), 0) / total).toFixed(1)
            : 0;

        const byRegion = {};
        reports.forEach(r => {
            const reg = r.region || 'غير محدد';
            byRegion[reg] = (byRegion[reg] || 0) + 1;
        });

        return { total, avgRating, avgAttendance, byRegion, reports };
    }

    async function logEmailSend({ reportId, sentTo, subject, status, errorMessage }) {
        const { error } = await getSupabase().from('email_logs').insert({
            report_id: reportId,
            sent_by: window.currentUser?.id,
            sent_to: sentTo,
            subject: subject,
            status: status,
            error_message: errorMessage || null
        });
        if (error) console.warn('email_logs:', error);
    }

    window.saveCompleteReport = saveCompleteReport;
    window.updateReport = updateReport;
    window.fetchUserReports = fetchUserReports;
    window.fetchAccessibleReports = fetchAccessibleReports;
    window.fetchReportById = fetchReportById;
    window.deleteReport = deleteReport;
    window.fetchReportStats = fetchReportStats;
    window.logEmailSend = logEmailSend;
})();
