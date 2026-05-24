/**
 * المناطق ومستويات المستخدم
 */
(function () {
    'use strict';

    const USER_LEVELS = {
        SUPER_ADMIN: 'مدير_عام',
        REGION_MANAGER: 'مدير_منطقة',
        COORDINATOR: 'منسق'
    };

    const LEVEL_LABELS = {
        'مدير_عام': 'مدير عام',
        'مدير_منطقة': 'مدير منطقة',
        'منسق': 'منسق'
    };

    let regionsCache = null;

    function getUserLevel() {
        return window.currentProfile?.user_level || USER_LEVELS.COORDINATOR;
    }

    function isSuperAdmin() {
        return getUserLevel() === USER_LEVELS.SUPER_ADMIN;
    }

    function isRegionManager() {
        return getUserLevel() === USER_LEVELS.REGION_MANAGER;
    }

    function isCoordinator() {
        return getUserLevel() === USER_LEVELS.COORDINATOR;
    }

    function isAdminUser() {
        return isSuperAdmin() || isRegionManager();
    }

    function getLevelLabel(level) {
        return LEVEL_LABELS[level] || level || 'منسق';
    }

    function getUserRegionName() {
        const p = window.currentProfile;
        if (p?.regions?.name) return p.regions.name;
        return p?.region || '';
    }

    async function fetchRegions() {
        if (regionsCache) return regionsCache;
        const { data, error } = await getSupabase().from('regions').select('id, name, code').order('name');
        if (error) throw error;
        regionsCache = data || [];
        return regionsCache;
    }

    function invalidateRegionsCache() {
        regionsCache = null;
    }

    async function resolveRegionId(regionName) {
        if (!regionName) return null;
        const regions = await fetchRegions();
        const match = regions.find(r => r.name === regionName);
        return match?.id || null;
    }

    function populateRegionSelect(selectEl, regions, selectedId) {
        if (!selectEl) return;
        selectEl.innerHTML = '<option value="">اختر المنطقة</option>';
        regions.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r.id;
            opt.textContent = r.name;
            opt.dataset.name = r.name;
            if (selectedId && r.id === selectedId) opt.selected = true;
            selectEl.appendChild(opt);
        });
    }

    window.USER_LEVELS = USER_LEVELS;
    window.getUserLevel = getUserLevel;
    window.isSuperAdmin = isSuperAdmin;
    window.isRegionManager = isRegionManager;
    window.isCoordinator = isCoordinator;
    window.isAdminUser = isAdminUser;
    window.getLevelLabel = getLevelLabel;
    window.getUserRegionName = getUserRegionName;
    window.fetchRegions = fetchRegions;
    window.resolveRegionId = resolveRegionId;
    window.populateRegionSelect = populateRegionSelect;
    window.invalidateRegionsCache = invalidateRegionsCache;
})();
