/**
 * إدارة المناطق
 */
(function () {
    'use strict';

    async function fetchAllRegions() {
        return fetchRegions();
    }

    async function fetchRegionStats(regionId) {
        const { data: region } = await getSupabase().from('regions').select('*').eq('id', regionId).single();
        const { data: reports } = await getSupabase().from('reports').select('overall_rating, attendance_rate, user_id').eq('region_id', regionId);
        const { count: coordinators } = await getSupabase()
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('region_id', regionId)
            .eq('user_level', 'منسق');

        const list = reports || [];
        const avgRating = list.length
            ? (list.reduce((s, r) => s + (r.overall_rating || 0), 0) / list.length).toFixed(1)
            : 0;
        const avgAttendance = list.length
            ? (list.reduce((s, r) => s + (parseFloat(r.attendance_rate) || 0), 0) / list.length).toFixed(1)
            : 0;

        return {
            region,
            reportCount: list.length,
            coordinatorCount: coordinators ?? 0,
            avgRating,
            avgAttendance
        };
    }

    async function fetchRegionsWithStats() {
        const regions = await fetchAllRegions();
        const stats = await Promise.all(regions.map(r => fetchRegionStats(r.id).catch(() => ({
            region: r, reportCount: 0, coordinatorCount: 0, avgRating: 0, avgAttendance: 0
        }))));
        return stats;
    }

    async function createRegion(name, code) {
        if (!isSuperAdmin()) throw new Error('صلاحية المدير العام فقط');
        const { data, error } = await getSupabase().from('regions').insert({ name, code }).select().single();
        if (error) throw error;
        if (typeof invalidateRegionsCache === 'function') invalidateRegionsCache();
        await logActivity('create_region', { name, code });
        return data;
    }

    async function updateRegion(id, name, code) {
        if (!isSuperAdmin()) throw new Error('صلاحية المدير العام فقط');
        const { data, error } = await getSupabase().from('regions').update({ name, code }).eq('id', id).select().single();
        if (error) throw error;
        if (typeof invalidateRegionsCache === 'function') invalidateRegionsCache();
        await logActivity('update_region', { id, name, code });
        return data;
    }

    async function deleteRegion(id) {
        if (!isSuperAdmin()) throw new Error('صلاحية المدير العام فقط');
        const { error } = await getSupabase().from('regions').delete().eq('id', id);
        if (error) throw error;
        if (typeof invalidateRegionsCache === 'function') invalidateRegionsCache();
        await logActivity('delete_region', { id });
    }

    async function assignRegionManager(profileId, regionId) {
        if (!isSuperAdmin()) throw new Error('صلاحية المدير العام فقط');
        const { data, error } = await getSupabase()
            .from('profiles')
            .update({ user_level: 'مدير_منطقة', region_id: regionId })
            .eq('id', profileId)
            .select()
            .single();
        if (error) throw error;
        await logActivity('assign_region_manager', { profileId, regionId });
        return data;
    }

    window.fetchAllRegions = fetchAllRegions;
    window.fetchRegionStats = fetchRegionStats;
    window.fetchRegionsWithStats = fetchRegionsWithStats;
    window.createRegion = createRegion;
    window.updateRegion = updateRegion;
    window.deleteRegion = deleteRegion;
    window.assignRegionManager = assignRegionManager;
})();
