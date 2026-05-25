/**
 * واجهة المصادقة — تسجيل الدخول وإنشاء الحساب
 */
(function () {
    'use strict';

    const AUTH_SELECTORS = {
        bar: '#authBar',
        guestActions: '#authGuestActions',
        userInfo: '#authUserInfo',
        userName: '#authUserName',
        loginPrompt: '#loginPrompt',
        appContent: '#appContent',
        reportsSection: '#previousReports'
    };

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function setVisible(el, visible) {
        if (!el) return;
        el.classList.toggle('hidden', !visible);
        el.setAttribute('aria-hidden', visible ? 'false' : 'true');
    }

    function updateAuthUI(session) {
        const { user, profile } = session || {};
        const guestActions = document.querySelector(AUTH_SELECTORS.guestActions);
        const userInfo = document.querySelector(AUTH_SELECTORS.userInfo);
        const userNameEl = document.querySelector(AUTH_SELECTORS.userName);
        const loginPrompt = document.querySelector(AUTH_SELECTORS.loginPrompt);
        const appContent = document.querySelector(AUTH_SELECTORS.appContent);
        const reportsSection = document.querySelector(AUTH_SELECTORS.reportsSection);

        const isLoggedIn = !!user;

        setVisible(guestActions, !isLoggedIn);
        setVisible(userInfo, isLoggedIn);
        setVisible(loginPrompt, !isLoggedIn);
        setVisible(appContent, isLoggedIn);
        setVisible(reportsSection, isLoggedIn);

        if (userNameEl) {
            const levelLabel = (typeof getLevelLabel === 'function' && profile?.user_level)
                ? ` (${getLevelLabel(profile.user_level)})` : '';
            userNameEl.textContent = (profile?.full_name || user?.email || 'مستخدم') + levelLabel;
        }

        const adminLink = document.getElementById('adminDashboardLink');
        const manageLink = document.getElementById('manageUsersLink');
        if (adminLink) {
            setVisible(adminLink, isLoggedIn && typeof isAdminUser === 'function' && isAdminUser());
        }
        if (manageLink) {
            setVisible(manageLink, isLoggedIn && typeof checkPermission === 'function' && checkPermission('مدير_منطقة'));
        }

        const reportsTitle = document.getElementById('reportsSectionTitle');
        if (reportsTitle && isLoggedIn) {
            if (typeof isSuperAdmin === 'function' && isSuperAdmin()) {
                reportsTitle.textContent = '📂 جميع التقارير';
            } else if (typeof isRegionManager === 'function' && isRegionManager()) {
                reportsTitle.textContent = '📂 تقارير المنطقة';
            } else {
                reportsTitle.textContent = '📂 تقاريري السابقة';
            }
        }
    }

    async function showLoginModal() {
        const demo = window.DEMO_CREDENTIALS || {};
        const result = await Swal.fire({
            title: 'تسجيل الدخول',
            html: `
                <div class="swal-auth-form">
                    <label class="swal-field">
                        <span>البريد الإلكتروني</span>
                        <input id="swal-login-email" type="email" class="swal2-input" value="${demo.email || ''}" placeholder="demo@gmail.com" dir="ltr">
                    </label>
                    <label class="swal-field">
                        <span>كلمة المرور</span>
                        <input id="swal-login-password" type="password" class="swal2-input" value="${demo.password || ''}" placeholder="********" dir="ltr">
                    </label>
                    <div class="demo-credentials swal-demo-hint">
                        <strong>حساب تجريبي:</strong>
                        <span dir="ltr">${demo.email || 'demo@gmail.com'} / ${demo.password || 'Demo@123456789'}</span>
                        <small>نفّذ supabase-seed.sql في SQL Editor أولاً</small>
                    </div>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'دخول',
            cancelButtonText: 'إلغاء',
            focusConfirm: false,
            customClass: { popup: 'swal-rtl' },
            preConfirm: () => {
                const email = document.getElementById('swal-login-email')?.value?.trim();
                const password = document.getElementById('swal-login-password')?.value;
                if (!email || !password) {
                    Swal.showValidationMessage('يرجى إدخال البريد وكلمة المرور');
                    return false;
                }
                return { email, password };
            }
        });

        if (!result.isConfirmed) return;

        try {
            Swal.fire({
                title: 'جاري تسجيل الدخول...',
                allowOutsideClick: false,
                showConfirmButton: false,
                didOpen: () => Swal.showLoading()
            });

            await Promise.race([
                signIn(result.value.email, result.value.password),
                new Promise((_, reject) => {
                    setTimeout(() => reject(new Error('انتهت مهلة الاتصال — حدّث الصفحة وحاول مرة أخرى')), 20000);
                })
            ]);

            updateAuthUI({ user: window.currentUser, profile: window.currentProfile });

            await Swal.fire({
                icon: 'success',
                title: 'تم',
                text: 'مرحباً بك!',
                timer: 2200,
                showConfirmButton: true
            });

            if (typeof loadPreviousReports === 'function') {
                loadPreviousReports().catch((e) => console.warn('[Login] تحميل التقارير:', e));
            }
            if (typeof redirectByRole === 'function') redirectByRole(true);
        } catch (err) {
            console.error('[Login]', err);
            await Swal.fire('خطأ', err.message || 'تعذر تسجيل الدخول', 'error');
        }
    }

    async function showRegisterModal() {
        const result = await Swal.fire({
            title: 'إنشاء حساب جديد',
            html: `
                <div class="swal-auth-form">
                    <label class="swal-field">
                        <span>الاسم الكامل</span>
                        <input id="swal-reg-name" type="text" class="swal2-input" placeholder="الاسم الكامل">
                    </label>
                    <label class="swal-field">
                        <span>البريد الإلكتروني</span>
                        <input id="swal-reg-email" type="email" class="swal2-input" placeholder="example@email.com" dir="ltr">
                    </label>
                    <label class="swal-field">
                        <span>كلمة المرور</span>
                        <input id="swal-reg-password" type="password" class="swal2-input" placeholder="6 أحرف على الأقل" dir="ltr">
                    </label>
                    <label class="swal-field">
                        <span>المسمى الوظيفي</span>
                        <select id="swal-reg-role" class="swal2-input">
                            <option value="">اختر</option>
                            <option value="منسق">منسق</option>
                            <option value="مشرف">مشرف</option>
                            <option value="مدير">مدير</option>
                        </select>
                    </label>
                    <label class="swal-field">
                        <span>المنطقة</span>
                        <input id="swal-reg-region" type="text" class="swal2-input" placeholder="المنطقة">
                    </label>
                </div>
            `,
            showCancelButton: true,
            confirmButtonText: 'إنشاء حساب',
            cancelButtonText: 'إلغاء',
            focusConfirm: false,
            customClass: { popup: 'swal-rtl swal-wide' },
            preConfirm: () => {
                const fullName = document.getElementById('swal-reg-name')?.value?.trim();
                const email = document.getElementById('swal-reg-email')?.value?.trim();
                const password = document.getElementById('swal-reg-password')?.value;
                const role = document.getElementById('swal-reg-role')?.value;
                const region = document.getElementById('swal-reg-region')?.value?.trim();

                if (!fullName || !email || !password || !role || !region) {
                    Swal.showValidationMessage('يرجى ملء جميع الحقول');
                    return false;
                }
                if (password.length < 6) {
                    Swal.showValidationMessage('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
                    return false;
                }
                return { fullName, email, password, role, region };
            }
        });

        if (!result.isConfirmed) return;

        try {
            Swal.fire({ title: 'جاري إنشاء الحساب...', allowOutsideClick: false, didOpen: () => Swal.showLoading() });
            const { user, session } = await signUp(result.value);

            if (!session) {
                Swal.fire(
                    'تم إنشاء الحساب',
                    'تحقق من بريدك الإلكتروني لتفعيل الحساب ثم سجّل الدخول.',
                    'info'
                );
                return;
            }

            updateAuthUI({ user: window.currentUser, profile: window.currentProfile });
            if (typeof loadPreviousReports === 'function') await loadPreviousReports();
            Swal.fire('تم', 'تم إنشاء حسابك بنجاح!', 'success');
        } catch (err) {
            Swal.fire('خطأ', err.message || 'تعذر إنشاء الحساب', 'error');
        }
    }

    async function handleSignOut() {
        const confirm = await Swal.fire({
            title: 'تسجيل الخروج',
            text: 'هل تريد تسجيل الخروج؟',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'نعم',
            cancelButtonText: 'إلغاء'
        });

        if (!confirm.isConfirmed) return;

        try {
            await signOut();
            updateAuthUI(null);
            const reportsList = document.getElementById('reportsList');
            if (reportsList) reportsList.innerHTML = '';
            Swal.fire('تم', 'تم تسجيل الخروج', 'success');
        } catch (err) {
            Swal.fire('خطأ', err.message || 'تعذر تسجيل الخروج', 'error');
        }
    }

    async function initAuth() {
        if (typeof warnIfFileProtocol === 'function' && warnIfFileProtocol()) {
            const banner = document.getElementById('fileProtocolBanner');
            if (banner) banner.classList.remove('hidden');
            updateAuthUI(null);
            return;
        }

        try {
            if (typeof ensureDatabaseReady === 'function') {
                const health = await ensureDatabaseReady({ silent: true });
                if (typeof showDbBanner === 'function') showDbBanner(health);
            }

            const session = await getCurrentUser();
            updateAuthUI(session);
            if (session?.user && typeof loadPreviousReports === 'function') {
                await loadPreviousReports();
            }
            if (session?.user && typeof redirectByRole === 'function') {
                redirectByRole(false);
            }
        } catch (err) {
            console.error('Auth init error:', err);
            updateAuthUI(null);
            if (!(typeof warnIfFileProtocol === 'function' && warnIfFileProtocol())) {
                Swal.fire('تنبيه', err.message || 'تعذر الاتصال بقاعدة البيانات. تحقق من config.js', 'warning');
            }
        }

        onAuthStateChange(({ user, profile }) => {
            updateAuthUI({ user, profile });
            if (user && typeof loadPreviousReports === 'function') {
                loadPreviousReports().catch(console.error);
            }
        });
    }

    window.showLoginModal = showLoginModal;
    window.showRegisterModal = showRegisterModal;
    window.handleSignOut = handleSignOut;
    window.initAuth = initAuth;
    window.updateAuthUI = updateAuthUI;
})();
