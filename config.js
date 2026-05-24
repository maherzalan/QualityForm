/**
 * إعدادات Supabase — انسخ القيم من ملف .env إلى هنا.
 * (ملف .env لا يُقرأ مباشرة في المتصفح بدون أداة بناء)
 */
window.SUPABASE_CONFIG = {
    url: 'https://ywpyublgyxwvqwekvydf.supabase.co',
    anonKey: 'sb_publishable_ScpPKdNcnCdqYf978CmzlA_Kwo0zupe',
};

/** EmailJS — https://www.emailjs.com */
window.EMAILJS_CONFIG = {
    serviceId: 'YOUR_SERVICE_ID',
    templateId: 'YOUR_TEMPLATE_ID',
    publicKey: 'YOUR_PUBLIC_KEY'
};

/** حساب تجريبي — أنشئه من Supabase Dashboard أو نفّذ supabase-seed.sql */
window.DEMO_CREDENTIALS = {
    email: 'demo.quality.unrwa@gmail.com',
    password: 'Demo@123456789'
};
