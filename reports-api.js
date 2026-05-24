/**
 * دوال حفظ وجلب التقارير من Supabase
 */
(function () {
    'use strict';

    function mapReportRow(data, userId) {
        return {
            user_id: userId,
            center_name: data.centerName,
            region: data.region,
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
            .insert(mapReportRow(formData, user.id))
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

    async function fetchUserReports() {
        const user = window.currentUser;
        if (!user) return [];

        const { data, error } = await getSupabase()
            .from('reports')
            .select('id, center_name, specialist_name, visit_date, entry_date, overall_rating, staff_count, student_count, attendance_rate, period_start, period_end, created_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        return data || [];
    }

    async function fetchReportById(reportId) {
        const user = window.currentUser;
        if (!user) throw new Error('يرجى تسجيل الدخول أولاً');

        const { data: report, error: reportError } = await getSupabase()
            .from('reports')
            .select('*')
            .eq('id', reportId)
            .eq('user_id', user.id)
            .single();

        if (reportError) throw reportError;

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

        const children = Object.fromEntries(results);
        return { report, ...children };
    }

    async function deleteReport(reportId) {
        const user = window.currentUser;
        if (!user) throw new Error('يرجى تسجيل الدخول أولاً');

        const { error } = await getSupabase()
            .from('reports')
            .delete()
            .eq('id', reportId)
            .eq('user_id', user.id);

        if (error) throw error;
        return true;
    }

    window.saveCompleteReport = saveCompleteReport;
    window.fetchUserReports = fetchUserReports;
    window.fetchReportById = fetchReportById;
    window.deleteReport = deleteReport;
})();
