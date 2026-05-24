/**
 * خدمة التقارير المتقدمة (طبقة فوق reports-api)
 */
(function () {
    'use strict';

    async function getAllReports(filters = {}) {
        if (!isSuperAdmin()) throw new Error('صلاحية المدير العام فقط');
        return fetchAccessibleReports(filters);
    }

    async function getRegionReports(regionId, filters = {}) {
        if (!checkPermission('مدير_منطقة')) throw new Error('لا تملك صلاحية');
        const region = (await getSupabase().from('regions').select('name').eq('id', regionId).single()).data;
        return fetchAccessibleReports({ ...filters, region: region?.name });
    }

    async function getMyReports(filters = {}) {
        if (!window.currentUser) return [];
        if (isCoordinator()) {
            return fetchAccessibleReports({ ...filters, _ownerOnly: window.currentUser.id });
        }
        return fetchAccessibleReports(filters);
    }

    async function getReportsByUser(userId, filters = {}) {
        if (!checkPermission('مدير_منطقة')) throw new Error('لا تملك صلاحية');
        const reports = await fetchAccessibleReports(filters);
        return reports.filter(r => r.user_id === userId);
    }

    async function getReportStatistics(filters = {}) {
        const stats = await fetchReportStats(filters);
        const byRating = {};
        (stats.reports || []).forEach(r => {
            const k = r.overall_rating || 'غير محدد';
            byRating[k] = (byRating[k] || 0) + 1;
        });
        return { ...stats, byRating };
    }

    async function exportReportsCsv(filters = {}) {
        const reports = await fetchAccessibleReports(filters);
        const headers = ['المركز', 'المنطقة', 'المختص', 'التاريخ', 'التقييم', 'الحضور', 'الدعم'];
        const rows = reports.map(r => [
            r.center_name, r.region, r.specialist_name, r.visit_date,
            r.overall_rating, r.attendance_rate, r.continue_support
        ]);
        const csv = [headers, ...rows].map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
        const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `reports_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        URL.revokeObjectURL(a.href);
        await logActivity('export_reports_csv', { count: reports.length });
    }

    window.getAllReports = getAllReports;
    window.getRegionReports = getRegionReports;
    window.getMyReports = getMyReports;
    window.getReportsByUser = getReportsByUser;
    window.getReportStatistics = getReportStatistics;
    window.exportReportsCsv = exportReportsCsv;
})();
