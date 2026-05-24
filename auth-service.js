/**
 * خدمة المصادقة والصلاحيات
 */
(function () {
    'use strict';

    const LEVEL_ORDER = { 'منسق': 1, 'مدير_منطقة': 2, 'مدير_عام': 3 };

    function getCurrentUserLevel() {
        return window.currentProfile?.user_level || 'منسق';
    }

    function getCurrentUserRegion() {
        const p = window.currentProfile;
        if (p?.regions) return p.regions;
        if (p?.region_id) return { id: p.region_id, name: p.region };
        return p?.region ? { name: p.region } : null;
    }

    function checkPermission(requiredLevel) {
        const current = getCurrentUserLevel();
        return (LEVEL_ORDER[current] || 0) >= (LEVEL_ORDER[requiredLevel] || 99);
    }

    async function logActivity(action, details) {
        if (!window.currentUser) return;
        try {
            await getSupabase().from('activity_logs').insert({
                user_id: window.currentUser.id,
                action,
                details: typeof details === 'string' ? details : JSON.stringify(details)
            });
        } catch (e) {
            console.warn('logActivity:', e);
        }
    }

    async function hasAccessToReport(reportId) {
        try {
            const { data, error } = await getSupabase()
                .from('reports')
                .select('id')
                .eq('id', reportId)
                .maybeSingle();
            return !error && !!data;
        } catch {
            return false;
        }
    }

    async function getManageableUsers() {
        const profile = window.currentProfile;
        if (!profile) return [];

        let query = getSupabase()
            .from('profiles')
            .select('id, full_name, email, role, region, region_id, user_level, manager_id, phone, regions:region_id(id, name, code)')
            .order('full_name');

        if (isSuperAdmin()) {
            const { data, error } = await query;
            if (error) throw error;
            return data || [];
        }

        if (isRegionManager()) {
            const { data, error } = await query
                .eq('user_level', 'منسق')
                .or(`manager_id.eq.${profile.id},region_id.eq.${profile.region_id}`);
            if (error) throw error;
            return data || [];
        }

        return [];
    }

    function redirectByRole(force) {
        if (!window.currentUser || !window.currentProfile) return;
        const path = (location.pathname || '').toLowerCase();
        const onAdmin = path.includes('admin-dashboard') || path.includes('manage-users');
        const onIndex = path.includes('index.html') || path.endsWith('/') || !/\.html$/i.test(path);

        if (isCoordinator() && onAdmin) {
            location.href = 'index.html';
            return;
        }
        if (!force) return;
        if (isAdminUser() && onIndex) {
            if (sessionStorage.getItem('stayOnIndex') === '1') {
                sessionStorage.removeItem('stayOnIndex');
                return;
            }
            location.href = 'admin-dashboard.html';
        }
    }

    window.getCurrentUserLevel = getCurrentUserLevel;
    window.getCurrentUserRegion = getCurrentUserRegion;
    window.checkPermission = checkPermission;
    window.logActivity = logActivity;
    window.hasAccessToReport = hasAccessToReport;
    window.getManageableUsers = getManageableUsers;
    window.redirectByRole = redirectByRole;
})();
