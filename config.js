/**
 * إعدادات Supabase — انسخ القيم من ملف .env إلى هنا.
 * (ملف .env لا يُقرأ مباشرة في المتصفح بدون أداة بناء)
 */
window.SUPABASE_CONFIG = {
    url: 'https://ywpyublgyxwvqwekvydf.supabase.co',
    // Publishable key (موصى به) أو Legacy anon key (يبدأ بـ eyJ) من: Project Settings → API
    anonKey: 'sb_publishable_ScpPKdNcnCdqYf978CmzlA_Kwo0zupe',
    // legacyAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...' // استخدمه إذا فشل المفتاح أعلاه
};

/** حساب تجريبي — أنشئه من Supabase Dashboard أو نفّذ supabase-seed.sql */
window.DEMO_CREDENTIALS = {
    email: 'demo.quality.unrwa@gmail.com',
    password: 'Demo@123456789'
};
