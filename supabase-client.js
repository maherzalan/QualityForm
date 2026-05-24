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
        supabaseClient = supabase.createClient(url, anonKey, {
            auth: {
                persistSession: true,
                autoRefreshToken: true,
                detectSessionInUrl: false,
                storage: getAuthStorage()
            }
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

    async function fetchProfile(userId) {
        const { data, error } = await getSupabase()
            .from('profiles')
            .select('id, full_name, role, region, job_title')
            .eq('id', userId)
            .maybeSingle();

        if (error) throw error;
        return data;
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
        try {
            currentProfile = await fetchProfile(data.user.id);
        } catch (profileErr) {
            console.warn('[Supabase] تسجيل الدخول نجح لكن profile غير موجود:', profileErr);
            currentProfile = null;
        }
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
            const { error: profileError } = await getSupabase().from('profiles').upsert({
                id: data.user.id,
                full_name: fullName,
                role: role,
                region: region,
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
        try {
            currentProfile = await fetchProfile(session.user.id);
        } catch {
            currentProfile = null;
        }
        return { user: currentUser, profile: currentProfile };
    }

    function onAuthStateChange(callback) {
        return getSupabase().auth.onAuthStateChange(async (_event, session) => {
            if (session?.user) {
                currentUser = session.user;
                try {
                    currentProfile = await fetchProfile(session.user.id);
                } catch {
                    currentProfile = null;
                }
            } else {
                currentUser = null;
                currentProfile = null;
            }
            callback({ user: currentUser, profile: currentProfile });
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
    window.fetchProfile = fetchProfile;
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
