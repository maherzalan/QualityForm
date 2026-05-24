/**
 * لوحة تحكم المديرين — تقارير، مناطق، مستخدمون، رسوم
 */
(function () {
    'use strict';

    const RATING_LABELS = { 1: '1', 2: '2', 3: '3', 4: '4', 5: '5' };
    let currentFilters = {};
    let chartByRegion = null;
    let chartByRating = null;
    let sortCol = -1;
    let sortAsc = true;

    function escapeHtml(t) {
        if (t == null) return '';
        const d = document.createElement('div');
        d.textContent = String(t);
        return d.innerHTML;
    }

    function formatDate(d) {
        if (!d) return '-';
        try {
            return new Date(d).toLocaleDateString('ar-EG');
        } catch {
            return d;
        }
    }

    function applyRoleTheme() {
        const body = document.getElementById('adminBody');
        const header = document.getElementById('adminHeader');
        if (!body) return;
        body.classList.remove('theme-super', 'theme-region', 'theme-coord');
        if (isSuperAdmin()) {
            body.classList.add('theme-super');
            if (header) header.classList.add('header-super');
            const title = document.getElementById('adminPageTitle');
            if (title) title.textContent = '👑 لوحة تحكم المدير العام';
        } else if (isRegionManager()) {
            body.classList.add('theme-region');
            const reg = window.currentProfile?.regions?.name || window.currentProfile?.region || '';
            const title = document.getElementById('adminPageTitle');
            if (title) title.textContent = `🏢 لوحة تحكم — ${reg}`;
        }
    }

    function setupTabsVisibility() {
        const showRegions = isSuperAdmin();
        const showUsers = checkPermission('مدير_منطقة');
        document.getElementById('tabRegionsBtn')?.classList.toggle('hidden', !showRegions);
        document.getElementById('tabUsersBtn')?.classList.toggle('hidden', !showUsers);
        document.getElementById('manageUsersLink')?.classList.toggle('hidden', !showUsers);
        document.getElementById('btnAddRegion')?.classList.toggle('hidden', !showRegions);
        document.getElementById('coordinatorsPanel')?.classList.toggle('hidden', !isRegionManager());
    }

    function switchAdminTab(tab) {
        document.querySelectorAll('.admin-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        document.getElementById('panelOverview')?.classList.toggle('hidden', tab !== 'overview');
        document.getElementById('panelReports')?.classList.toggle('hidden', tab !== 'reports');
        document.getElementById('panelRegions')?.classList.toggle('hidden', tab !== 'regions');
        document.getElementById('panelUsers')?.classList.toggle('hidden', tab !== 'users');
        document.getElementById('reportsSidebar')?.classList.toggle('hidden', tab !== 'reports' && tab !== 'overview');
        if (tab === 'regions') loadRegionsPanel();
        if (tab === 'users') refreshUsersList();
    }

    function getFiltersFromUI() {
        return {
            region: document.getElementById('filterRegion')?.value || '',
            centerName: document.getElementById('filterCenter')?.value?.trim() || '',
            rating: document.getElementById('filterRating')?.value || '',
            dateFrom: document.getElementById('filterDateFrom')?.value || '',
            dateTo: document.getElementById('filterDateTo')?.value || '',
            continueSupport: document.getElementById('filterSupport')?.value || ''
        };
    }

    function renderStats(stats, extra = {}) {
        const el = document.getElementById('adminStats');
        if (!el) return;

        const regionRows = Object.entries(stats.byRegion || {})
            .map(([name, count]) => `<li><span>${escapeHtml(name)}</span><strong>${count}</strong></li>`)
            .join('');

        const cards = [
            `<div class="stat-card"><div class="stat-value">${stats.total}</div><div class="stat-label">إجمالي التقارير</div></div>`,
            `<div class="stat-card"><div class="stat-value">${stats.avgRating}</div><div class="stat-label">متوسط التقييم</div></div>`,
            `<div class="stat-card"><div class="stat-value">${stats.avgAttendance}%</div><div class="stat-label">متوسط الحضور</div></div>`
        ];

        if (extra.coordinators != null) {
            cards.unshift(`<div class="stat-card"><div class="stat-value">${extra.coordinators}</div><div class="stat-label">المنسقون</div></div>`);
        }
        if (extra.regions != null) {
            cards.unshift(`<div class="stat-card"><div class="stat-value">${extra.regions}</div><div class="stat-label">المناطق</div></div>`);
        }
        if (extra.users != null) {
            cards.unshift(`<div class="stat-card"><div class="stat-value">${extra.users}</div><div class="stat-label">المستخدمون</div></div>`);
        }

        el.innerHTML = cards.join('') +
            `<div class="stat-card stat-regions"><div class="stat-label">حسب المنطقة</div><ul>${regionRows || '<li>لا توجد بيانات</li>'}</ul></div>`;
    }

    function canDeleteReports() {
        return isSuperAdmin() || isRegionManager();
    }

    function renderTable(reports) {
        const tbody = document.getElementById('adminReportsBody');
        if (!tbody) return;

        if (!reports.length) {
            tbody.innerHTML = '<tr><td colspan="7" class="empty-cell">لا توجد تقارير مطابقة</td></tr>';
            return;
        }

        tbody.innerHTML = reports.map(r => `
            <tr data-search="${escapeHtml([r.center_name, r.region, r.specialist_name].join(' ').toLowerCase())}">
                <td>${escapeHtml(r.center_name)}</td>
                <td>${escapeHtml(r.region)}</td>
                <td>${escapeHtml(r.specialist_name)}</td>
                <td>${formatDate(r.visit_date)}</td>
                <td>${escapeHtml(RATING_LABELS[r.overall_rating] || r.overall_rating || '-')}</td>
                <td>${escapeHtml(r.attendance_rate)}%</td>
                <td class="actions-cell">
                    <button type="button" class="btn-sm btn-view" onclick="viewReportDetails('${r.id}')">عرض</button>
                    <button type="button" class="btn-sm btn-email" onclick="showShareReportModal('${r.id}')">📧</button>
                    ${canDeleteReports() ? `<button type="button" class="btn-sm btn-del" onclick="confirmDeleteReport('${r.id}')">حذف</button>` : ''}
                </td>
            </tr>
        `).join('');
    }

    function filterAdminTableLocal() {
        const q = (document.getElementById('reportQuickSearch')?.value || '').trim().toLowerCase();
        document.querySelectorAll('#adminReportsBody tr').forEach(tr => {
            const hay = tr.getAttribute('data-search') || tr.textContent.toLowerCase();
            tr.style.display = !q || hay.includes(q) ? '' : 'none';
        });
    }

    function sortAdminTable(col) {
        const reports = window._lastAdminReports || [];
        if (!reports.length) return;
        if (sortCol === col) sortAsc = !sortAsc;
        else { sortCol = col; sortAsc = true; }
        const keys = ['center_name', 'region', 'specialist_name', 'visit_date', 'overall_rating', 'attendance_rate'];
        const key = keys[col];
        reports.sort((a, b) => {
            let va = a[key], vb = b[key];
            if (key === 'visit_date') { va = new Date(va || 0); vb = new Date(vb || 0); }
            if (va < vb) return sortAsc ? -1 : 1;
            if (va > vb) return sortAsc ? 1 : -1;
            return 0;
        });
        renderTable(reports);
    }

    function renderCharts(stats) {
        if (typeof Chart === 'undefined') return;
        const byRegion = stats.byRegion || {};
        const labels = Object.keys(byRegion);
        const counts = Object.values(byRegion);

        const ctx1 = document.getElementById('chartByRegion');
        if (ctx1) {
            if (chartByRegion) chartByRegion.destroy();
            chartByRegion = new Chart(ctx1, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{ label: 'عدد التقارير', data: counts, backgroundColor: '#3B82F6' }]
                },
                options: { responsive: true, plugins: { legend: { display: false } } }
            });
        }

        const byRating = {};
        (stats.reports || []).forEach(r => {
            const k = r.overall_rating || 'غير محدد';
            byRating[k] = (byRating[k] || 0) + 1;
        });
        const ctx2 = document.getElementById('chartByRating');
        if (ctx2) {
            if (chartByRating) chartByRating.destroy();
            chartByRating = new Chart(ctx2, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(byRating),
                    datasets: [{ data: Object.values(byRating), backgroundColor: ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#94A3B8'] }]
                },
                options: { responsive: true }
            });
        }
    }

    async function loadCoordinatorsPanel(reports) {
        if (!isRegionManager()) return;
        const users = await getManageableUsers();
        const counts = {};
        (reports || []).forEach(r => {
            counts[r.user_id] = (counts[r.user_id] || 0) + 1;
        });
        const el = document.getElementById('coordinatorsTable');
        if (!el) return;
        if (!users.length) {
            el.innerHTML = '<p class="empty-cell">لا يوجد منسقون</p>';
            return;
        }
        el.innerHTML = `
            <table class="admin-table">
                <thead><tr><th>الاسم</th><th>البريد</th><th>عدد التقارير</th></tr></thead>
                <tbody>
                    ${users.map(u => `
                        <tr>
                            <td>${escapeHtml(u.full_name)}</td>
                            <td dir="ltr">${escapeHtml(u.email || '-')}</td>
                            <td>${counts[u.id] || 0}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async function loadRegionsPanel() {
        const wrap = document.getElementById('regionsTableWrap');
        if (!wrap) return;
        try {
            let statsList = await fetchRegionsWithStats();
            if (isRegionManager() && window.currentProfile?.region_id) {
                statsList = statsList.filter(s => s.region?.id === window.currentProfile.region_id);
            }
            wrap.innerHTML = `
                <table class="admin-table">
                    <thead>
                        <tr><th>المنطقة</th><th>التقارير</th><th>المنسقون</th><th>متوسط التقييم</th><th>متوسط الحضور</th>
                        ${isSuperAdmin() ? '<th>إجراءات</th>' : ''}</tr>
                    </thead>
                    <tbody>
                        ${statsList.map(s => `
                            <tr>
                                <td>${escapeHtml(s.region?.name)}</td>
                                <td>${s.reportCount}</td>
                                <td>${s.coordinatorCount}</td>
                                <td>${s.avgRating}</td>
                                <td>${s.avgAttendance}%</td>
                                ${isSuperAdmin() ? `<td class="actions-cell">
                                    <button type="button" class="btn-sm btn-view" data-region-id="${s.region.id}" data-region-name="${escapeHtml(s.region.name)}" data-region-code="${escapeHtml(s.region.code)}" onclick="openEditRegionFromBtn(this)">تعديل</button>
                                </td>` : ''}
                            </tr>
                        `).join('') || '<tr><td colspan="6" class="empty-cell">لا توجد مناطق</td></tr>'}
                    </tbody>
                </table>
            `;
        } catch (e) {
            wrap.innerHTML = `<p class="empty-cell">${escapeHtml(e.message)}</p>`;
        }
    }

    async function openAddRegionModal() {
        const { value: form } = await Swal.fire({
            title: 'إضافة منطقة',
            html: `
                <input id="rg-name" class="swal2-input" placeholder="اسم المنطقة">
                <input id="rg-code" class="swal2-input" placeholder="CODE مثل GAZA" dir="ltr">
            `,
            showCancelButton: true,
            confirmButtonText: 'إضافة',
            preConfirm: () => ({
                name: document.getElementById('rg-name')?.value?.trim(),
                code: document.getElementById('rg-code')?.value?.trim()
            })
        });
        if (!form?.name || !form?.code) return;
        try {
            await createRegion(form.name, form.code);
            Swal.fire('تم', 'تمت الإضافة', 'success');
            loadRegionsPanel();
        } catch (e) {
            Swal.fire('خطأ', e.message, 'error');
        }
    }

    async function openEditRegionFromBtn(btn) {
        const id = btn.dataset.regionId;
        const name = btn.dataset.regionName;
        const code = btn.dataset.regionCode;
        await openEditRegionModal(id, name, code);
    }

    async function openEditRegionModal(id, name, code) {
        const { value: form } = await Swal.fire({
            title: 'تعديل المنطقة',
            html: `
                <input id="rg-name" class="swal2-input" value="${name}">
                <input id="rg-code" class="swal2-input" value="${code}" dir="ltr">
            `,
            showCancelButton: true,
            confirmButtonText: 'حفظ',
            preConfirm: () => ({
                name: document.getElementById('rg-name')?.value?.trim(),
                code: document.getElementById('rg-code')?.value?.trim()
            })
        });
        if (!form?.name) return;
        try {
            await updateRegion(id, form.name, form.code);
            Swal.fire('تم', 'تم التحديث', 'success');
            loadRegionsPanel();
        } catch (e) {
            Swal.fire('خطأ', e.message, 'error');
        }
    }

    async function refreshUsersList() {
        if (!checkPermission('مدير_منطقة')) return;
        const users = await getManageableUsers();
        renderUsersTable(users, 'usersTableWrap');
    }

    function exportCsv(reports) {
        if (typeof exportReportsCsv === 'function') {
            return exportReportsCsv(currentFilters);
        }
        const headers = ['المركز', 'المنطقة', 'المختص', 'تاريخ الزيارة', 'التقييم', 'الحضور', 'الدعم'];
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
    }

    async function loadAdminDashboard() {
        if (!window.currentUser) {
            window.location.href = 'index.html';
            return;
        }

        if (!isAdminUser()) {
            Swal.fire('تنبيه', 'ليس لديك صلاحية لوحة التحكم', 'warning').then(() => {
                window.location.href = 'index.html';
            });
            return;
        }

        applyRoleTheme();
        setupTabsVisibility();

        const profile = window.currentProfile;
        const titleEl = document.getElementById('adminWelcome');
        if (titleEl) {
            titleEl.innerHTML = `${escapeHtml(profile?.full_name || 'مدير')} — <span class="level-badge level-${getUserLevel()}">${getLevelLabel(getUserLevel())}</span>`;
        }

        const regionFilter = document.getElementById('filterRegion');
        if (regionFilter) {
            const regions = await fetchRegions();
            populateRegionSelect(regionFilter, regions);
            if (isRegionManager() && profile?.region_id) {
                regionFilter.value = profile.region_id;
                regionFilter.disabled = true;
            }
        }

        await refreshAdminData();
        await logActivity('view_admin_dashboard', {});
    }

    async function refreshAdminData() {
        currentFilters = getFiltersFromUI();
        const regionSelect = document.getElementById('filterRegion');
        if (regionSelect?.value) {
            const opt = regionSelect.selectedOptions[0];
            currentFilters.region = opt?.dataset?.name || opt?.textContent || '';
        }

        try {
            const stats = await fetchReportStats(currentFilters);
            let extra = {};
            if (isSuperAdmin()) {
                const users = await getManageableUsers();
                const regions = await fetchRegions();
                extra = { users: users.length, regions: regions.length };
            } else if (isRegionManager()) {
                const users = await getManageableUsers();
                extra = { coordinators: users.length };
            }
            renderStats(stats, extra);
            renderTable(stats.reports);
            renderCharts(stats);
            await loadCoordinatorsPanel(stats.reports);
            window._lastAdminReports = stats.reports;
        } catch (err) {
            console.error(err);
            Swal.fire('خطأ', err.message || 'تعذر تحميل البيانات', 'error');
        }
    }

    function resetFilters() {
        ['filterCenter', 'filterRating', 'filterDateFrom', 'filterDateTo', 'filterSupport'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const regionFilter = document.getElementById('filterRegion');
        if (regionFilter && !regionFilter.disabled) regionFilter.value = '';
        if (isRegionManager() && window.currentProfile?.region_id && regionFilter) {
            regionFilter.value = window.currentProfile.region_id;
        }
        refreshAdminData();
    }

    window.loadAdminDashboard = loadAdminDashboard;
    window.refreshAdminData = refreshAdminData;
    window.resetAdminFilters = resetFilters;
    window.exportAdminCsv = () => exportCsv(window._lastAdminReports || []);
    window.switchAdminTab = switchAdminTab;
    window.filterAdminTableLocal = filterAdminTableLocal;
    window.sortAdminTable = sortAdminTable;
    window.refreshUsersList = refreshUsersList;
    window.loadRegionsPanel = loadRegionsPanel;
    window.openAddRegionModal = openAddRegionModal;
    window.openEditRegionModal = openEditRegionModal;
    window.openEditRegionFromBtn = openEditRegionFromBtn;
})();
