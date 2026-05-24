/**
 * إدارة المستخدمين
 */
(function () {
    'use strict';

    function escapeHtml(t) {
        if (t == null) return '';
        const d = document.createElement('div');
        d.textContent = String(t);
        return d.innerHTML;
    }

    async function createManagedUser({ email, password, fullName, regionId, userLevel, phone }) {
        if (!checkPermission('مدير_منطقة')) throw new Error('لا تملك صلاحية إنشاء مستخدم');

        if (isRegionManager()) {
            if (userLevel !== 'منسق') throw new Error('مدير المنطقة يمكنه إنشاء منسقين فقط');
        }

        const { data: authData, error: authError } = await getSupabase().auth.signUp({ email, password });
        if (authError) throw authError;
        if (!authData.user) throw new Error('تعذر إنشاء الحساب');

        const region = regionId ? (await getSupabase().from('regions').select('name').eq('id', regionId).single()).data : null;

        const profileRow = {
            id: authData.user.id,
            full_name: fullName,
            email,
            phone: phone || null,
            region_id: regionId || null,
            region: region?.name || '',
            user_level: userLevel || 'منسق',
            manager_id: isRegionManager() ? window.currentUser.id : null,
            role: userLevel === 'مدير_منطقة' ? 'مشرف' : 'منسق',
            job_title: userLevel === 'مدير_منطقة' ? 'مشرف' : 'منسق',
            updated_at: new Date().toISOString()
        };

        const { error: profileError } = await getSupabase().from('profiles').upsert(profileRow);
        if (profileError) throw profileError;

        await logActivity('create_user', { email, userLevel, regionId });
        return authData.user;
    }

    async function updateManagedUser(userId, updates) {
        if (!checkPermission('مدير_منطقة')) throw new Error('لا تملك صلاحية التعديل');

        if (isRegionManager() && updates.user_level && updates.user_level !== 'منسق') {
            throw new Error('لا يمكن ترقية المستخدم إلى مدير');
        }

        if (updates.region_id) {
            const { data: reg } = await getSupabase().from('regions').select('name').eq('id', updates.region_id).single();
            updates.region = reg?.name || updates.region;
        }

        updates.updated_at = new Date().toISOString();

        const { data, error } = await getSupabase().from('profiles').update(updates).eq('id', userId).select().single();
        if (error) throw error;
        await logActivity('update_user', { userId, updates });
        return data;
    }

    async function setUserLevel(userId, userLevel, regionId) {
        if (!isSuperAdmin()) throw new Error('صلاحية المدير العام فقط');
        return updateManagedUser(userId, { user_level: userLevel, region_id: regionId || null });
    }

    function renderUsersTable(users, containerId) {
        const el = document.getElementById(containerId);
        if (!el) return;

        if (!users.length) {
            el.innerHTML = '<p class="empty-cell">لا يوجد مستخدمون</p>';
            return;
        }

        const canEdit = checkPermission('مدير_منطقة');
        const canPromote = isSuperAdmin();

        el.innerHTML = `
            <table class="admin-table">
                <thead>
                    <tr>
                        <th>الاسم</th><th>البريد</th><th>المنطقة</th><th>المستوى</th><th>إجراءات</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => `
                        <tr data-user-id="${u.id}">
                            <td>${escapeHtml(u.full_name)}</td>
                            <td dir="ltr">${escapeHtml(u.email || '-')}</td>
                            <td>${escapeHtml(u.regions?.name || u.region || '-')}</td>
                            <td><span class="level-badge level-${u.user_level}">${escapeHtml(getLevelLabel(u.user_level))}</span></td>
                            <td class="actions-cell">
                                ${canEdit ? `<button type="button" class="btn-sm btn-view" onclick="openEditUserModal('${u.id}')">تعديل</button>` : ''}
                                ${canPromote ? `<button type="button" class="btn-sm btn-email" onclick="openPromoteUserModal('${u.id}')">ترقية</button>` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    async function openCreateUserModal() {
        const regions = await fetchRegions();
        const levelOptions = isSuperAdmin()
            ? `<option value="منسق">منسق</option><option value="مدير_منطقة">مدير منطقة</option>`
            : `<option value="منسق">منسق</option>`;

        const regionOptions = regions.map(r =>
            `<option value="${r.id}" ${isRegionManager() && r.id === window.currentProfile?.region_id ? 'selected' : ''}>${escapeHtml(r.name)}</option>`
        ).join('');

        const { value: form } = await Swal.fire({
            title: 'إضافة مستخدم',
            html: `
                <div class="swal-auth-form">
                    <input id="nu-name" class="swal2-input" placeholder="الاسم الكامل">
                    <input id="nu-email" class="swal2-input" placeholder="البريد" dir="ltr">
                    <input id="nu-pass" type="password" class="swal2-input" placeholder="كلمة المرور" dir="ltr">
                    <input id="nu-phone" class="swal2-input" placeholder="الهاتف (اختياري)">
                    <select id="nu-level" class="swal2-input">${levelOptions}</select>
                    <select id="nu-region" class="swal2-input">${regionOptions}</select>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'إنشاء',
            cancelButtonText: 'إلغاء',
            customClass: { popup: 'swal-rtl swal-wide' },
            preConfirm: () => ({
                fullName: document.getElementById('nu-name')?.value?.trim(),
                email: document.getElementById('nu-email')?.value?.trim(),
                password: document.getElementById('nu-pass')?.value,
                phone: document.getElementById('nu-phone')?.value?.trim(),
                userLevel: document.getElementById('nu-level')?.value,
                regionId: document.getElementById('nu-region')?.value
            })
        });

        if (!form) return;
        if (!form.fullName || !form.email || !form.password) {
            Swal.fire('تنبيه', 'املأ الحقول الإلزامية', 'warning');
            return;
        }

        try {
            Swal.fire({ title: 'جاري الإنشاء...', didOpen: () => Swal.showLoading() });
            await createManagedUser({
                email: form.email,
                password: form.password,
                fullName: form.fullName,
                regionId: form.regionId,
                userLevel: form.userLevel,
                phone: form.phone
            });
            Swal.fire('تم', 'تم إنشاء المستخدم', 'success');
            if (typeof refreshUsersList === 'function') await refreshUsersList();
        } catch (e) {
            Swal.fire('خطأ', e.message, 'error');
        }
    }

    async function openEditUserModal(userId) {
        const users = await getManageableUsers();
        const u = users.find(x => x.id === userId);
        if (!u) return;

        const { value: fullName } = await Swal.fire({
            title: 'تعديل المستخدم',
            input: 'text',
            inputValue: u.full_name,
            showCancelButton: true,
            confirmButtonText: 'حفظ'
        });
        if (fullName === undefined) return;

        try {
            await updateManagedUser(userId, { full_name: fullName });
            Swal.fire('تم', 'تم التحديث', 'success');
            if (typeof refreshUsersList === 'function') await refreshUsersList();
        } catch (e) {
            Swal.fire('خطأ', e.message, 'error');
        }
    }

    async function openPromoteUserModal(userId) {
        const regions = await fetchRegions();
        const { value: regionId } = await Swal.fire({
            title: 'ترقية إلى مدير منطقة',
            input: 'select',
            inputOptions: Object.fromEntries(regions.map(r => [r.id, r.name])),
            showCancelButton: true,
            confirmButtonText: 'ترقية'
        });
        if (!regionId) return;
        try {
            await setUserLevel(userId, 'مدير_منطقة', regionId);
            Swal.fire('تم', 'تمت الترقية', 'success');
            if (typeof refreshUsersList === 'function') await refreshUsersList();
        } catch (e) {
            Swal.fire('خطأ', e.message, 'error');
        }
    }

    window.createManagedUser = createManagedUser;
    window.updateManagedUser = updateManagedUser;
    window.setUserLevel = setUserLevel;
    window.renderUsersTable = renderUsersTable;
    window.openCreateUserModal = openCreateUserModal;
    window.openEditUserModal = openEditUserModal;
    window.openPromoteUserModal = openPromoteUserModal;
})();
