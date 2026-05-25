/**
 * تهيئة Supabase ودوال المصادقة
 */
(function () {
    'use strict';

    let supabaseClient = null;
    let currentUser = null;
    let currentProfile = null;
    const memoryAuthStore = {};

    function getAuthStorage() {
        if (typeof window === 'undefined') return memoryAuthStore;
        try {
            const testKey = '__supabase_storage_test__';
            window.localStorage.setItem(testKey, '1');
            window.localStorage.removeItem(testKey);
            return window.localStorage;
        } catch {
            console.warn('[Supabase] localStorage غير متاح (غالباً بسبب file://) — يُستخدم تخزين مؤقت في الذاكرة');
            return {
                getItem: (key) => memoryAuthStore[key] ?? null,
                setItem: (key, value) => { memoryAuthStore[key] = value; },
                removeItem: (key) => { delete memoryAuthStore[key]; }
            };
        }
    }

    function isFileProtocol() {
        return typeof window !== 'undefined' && window.location?.protocol === 'file:';
    }

    function getConfig() {
        const cfg = window.SUPABASE_CONFIG || {};
        const url = cfg.url;
        const anonKey = cfg.anonKey || cfg.publishableKey || cfg.legacyAnonKey;

        if (!url || !anonKey || url.includes('YOUR_SUPABASE')) {
            throw new Error('يرجى ضبط url و anonKey في ملف config.js');
        }
        if (anonKey.startsWith('sb_publishable_') === false && anonKey.startsWith('eyJ') === false) {
            console.warn('[Supabase] تأكد من المفتاح: Publishable (sb_publishable_...) أو Legacy anon (eyJ...) من لوحة Supabase → API');
        }
        return { url, anonKey };
    }

    function getSupabase() {
        if (supabaseClient) return supabaseClient;
        if (typeof supabase === 'undefined' || !supabase.createClient) {
            throw new Error('مكتبة Supabase غير محمّلة');
        }
        const { url, anonKey } = getConfig();

        function fetchWithTimeout(input, init = {}) {
            const ms = 15000;
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), ms);
            const merged = { ...init, signal: controller.signal };
            return fetch(input, merged).finally(() => clearTimeout(id));
        }

        supabaseClient = supabase.createClient(url, anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false,
                storage: getAuthStorage()
            },
            global: { fetch: fetchWithTimeout }
        });
        return supabaseClient;
    }

    function translateAuthError(error) {
        const msg = (error?.message || '').toLowerCase();
        const code = (error?.code || error?.error_code || '').toLowerCase();

        if (isFileProtocol()) {
            return 'لا تفتح الملف مباشرة (file://). شغّل start-server.bat ثم افتح http://localhost:5500';
        }
        if (msg.includes('invalid login credentials') || code.includes('invalid_credentials')) {
            return 'بيانات الدخول غير صحيحة. أنشئ المستخدم يدوياً من Supabase → Authentication → Users (مع Auto Confirm). لا تستخدم demo@gmail.com — Supabase يرفضه.';
        }
        if (msg.includes('email_address_invalid') || code.includes('email_address_invalid')) {
            return 'البريد مرفوض من Supabase. استخدم بريداً حقيقياً (مثل Gmail) أو أنشئ المستخدم من لوحة Authentication → Users.';
        }
        if (msg.includes('email not confirmed')) {
            return 'البريد غير مفعّل. عطّل Confirm email في Authentication → Providers → Email.';
        }
        if (msg.includes('failed to fetch') || msg.includes('network')) {
            return 'تعذر الاتصال بـ Supabase. تحقق من الإنترنت أو شغّل الصفحة عبر http://localhost وليس file://';
        }
        if (msg.includes('user already registered')) {
            return 'هذا البريد مسجّل مسبقاً. جرّب تسجيل الدخول.';
        }
        return error?.message || 'حدث خطأ غير متوقع';
    }

    const PROFILE_SELECT =
        'id, full_name, role, region, job_title, user_level, region_id, manager_id, email, phone, regions:region_id(id, name, code)';
    const PROFILE_FETCH_MS = 8000;

    function profileFromMetadata(user) {
        const meta = user?.user_metadata || {};
        return {
            id: user.id,
            email: user.email,
            full_name: meta.full_name || user.email?.split('@')[0] || 'مستخدم',
            role: 'منسق',
            job_title: 'منسق',
            user_level: 'منسق'
        };
    }

    function withTimeout(promise, ms, label) {
        return Promise.race([
            promise,
            new Promise((_, reject) => {
                setTimeout(() => reject(new Error(`timeout: ${label}`)), ms);
            })
        ]);
    }

    async function fetchProfile(userId) {
        const { data, error } = await getSupabase()
            .from('profiles')
            .select(PROFILE_SELECT)
            .eq('id', userId)
            .maybeSingle();

        if (error) {
            const msg = (error.message || '').toLowerCase();
            if (msg.includes('infinite recursion') || msg.includes('42p17')) {
                console.warn('[Supabase] RLS recursion على profiles — نفّذ الهجرة 20250101000005_fix_rls_recursion.sql');
            }
            throw error;
        }
        return data;
    }

    async function ensureProfileForUser(user) {
        let profile = await withTimeout(fetchProfile(user.id), PROFILE_FETCH_MS, 'fetchProfile').catch(() => null);
        if (profile) return profile;

        const meta = user.user_metadata || {};
        const row = {
            id: user.id,
            full_name: meta.full_name || user.email?.split('@')[0] || 'مستخدم',
            email: user.email,
            role: 'منسق',
            job_title: 'منسق',
            user_level: 'منسق',
            updated_at: new Date().toISOString()
        };

        const { data, error } = await withTimeout(
            getSupabase().from('profiles').upsert(row).select(PROFILE_SELECT).single(),
            PROFILE_FETCH_MS,
            'upsertProfile'
        );

        if (error) throw error;
        return data;
    }

    function queueProfileRefresh(user, onUpdated) {
        const userId = user.id;
        setTimeout(() => {
            ensureProfileForUser(user)
                .then((profile) => {
                    if (currentUser?.id === userId && profile) {
                        currentProfile = profile;
                        if (typeof onUpdated === 'function') {
                            onUpdated({ user: currentUser, profile: currentProfile });
                        }
                    }
                })
                .catch((e) => console.warn('[Supabase] profile refresh:', e));
        }, 0);
    }

    async function signIn(email, password) {
        if (isFileProtocol()) {
            throw new Error(translateAuthError({ message: 'file protocol' }));
        }

        const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
        if (error) {
            console.error('[Supabase signIn]', error);
            throw new Error(translateAuthError(error));
        }

        currentUser = data.user;
        currentProfile = profileFromMetadata(data.user);
        queueProfileRefresh(data.user);
        return { user: currentUser, profile: currentProfile };
    }

    async function signUp({ email, password, fullName, role, region }) {
        if (isFileProtocol()) {
            throw new Error(translateAuthError({ message: 'file protocol' }));
        }

        const { data, error } = await getSupabase().auth.signUp({ email, password });
        if (error) {
            console.error('[Supabase signUp]', error);
            throw new Error(translateAuthError(error));
        }

        if (data.user) {
            const regionId = typeof resolveRegionId === 'function' ? await resolveRegionId(region) : null;
            const { error: profileError } = await getSupabase().from('profiles').upsert({
                id: data.user.id,
                full_name: fullName,
                role: role,
                region: region,
                region_id: regionId,
                user_level: 'منسق',
                email: email,
                job_title: role,
                updated_at: new Date().toISOString()
            });
            if (profileError) {
                console.error('[Supabase profile]', profileError);
                throw new Error(profileError.message || 'تعذر إنشاء الملف الشخصي');
            }
            currentUser = data.user;
            currentProfile = await fetchProfile(data.user.id);
        }

        return { user: data.user, profile: currentProfile, session: data.session };
    }

    async function signOut() {
        const { error } = await getSupabase().auth.signOut();
        if (error) throw error;
        currentUser = null;
        currentProfile = null;
    }

    async function getCurrentUser() {
        if (isFileProtocol()) return null;

        const { data: { session }, error } = await getSupabase().auth.getSession();
        if (error) throw error;
        if (!session?.user) {
            currentUser = null;
            currentProfile = null;
            return null;
        }
        currentUser = session.user;
        currentProfile = profileFromMetadata(session.user);
        queueProfileRefresh(session.user);
        return { user: currentUser, profile: currentProfile };
    }

    function onAuthStateChange(callback) {
        // لا تستخدم async هنا — يعلّق signInWithPassword (مشكلة معروفة في supabase-js)
        return getSupabase().auth.onAuthStateChange((_event, session) => {
            if (session?.user) {
                currentUser = session.user;
                if (!currentProfile || currentProfile.id !== session.user.id) {
                    currentProfile = profileFromMetadata(session.user);
                }
                callback({ user: currentUser, profile: currentProfile });
                queueProfileRefresh(session.user, callback);
            } else {
                currentUser = null;
                currentProfile = null;
                callback({ user: null, profile: null });
            }
        });
    }

    function warnIfFileProtocol() {
        if (!isFileProtocol()) return false;
        return true;
    }

    window.getSupabase = getSupabase;
    window.signIn = signIn;
    window.signUp = signUp;
    window.signOut = signOut;
    window.getCurrentUser = getCurrentUser;
    window.onAuthStateChange = onAuthStateChange;
    async function refreshCurrentProfile() {
        if (!currentUser) return null;
        try {
            currentProfile = await ensureProfileForUser(currentUser);
        } catch (e) {
            console.warn('[Supabase] refreshCurrentProfile:', e);
        }
        return currentProfile;
    }

    window.fetchProfile = fetchProfile;
    window.refreshCurrentProfile = refreshCurrentProfile;
    window.isFileProtocol = isFileProtocol;
    window.warnIfFileProtocol = warnIfFileProtocol;

    Object.defineProperty(window, 'currentUser', {
        get: () => currentUser,
        configurable: true
    });
    Object.defineProperty(window, 'currentProfile', {
        get: () => currentProfile,
        configurable: true
    });
})();
