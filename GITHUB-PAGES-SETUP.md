# نشر GitHub Pages + Supabase

الموقع المنشور: https://maherzalan.github.io/QualityForm/

## 1) إعدادات Supabase Auth (مهم)

في **Authentication** → **URL Configuration**:

| الحقل | القيمة |
|--------|--------|
| Site URL | `https://maherzalan.github.io/QualityForm/` |
| Redirect URLs | `https://maherzalan.github.io/QualityForm/**` |

في **Authentication** → **Providers** → **Email**:

- عطّل **Confirm email** أثناء التطوير

## 2) إنشاء مستخدم (لا تستخدم demo@gmail.com)

Supabase **يرفض** البريد `demo@gmail.com` (`email_address_invalid`).

### الطريقة الموصى بها — من لوحة Supabase

1. **Authentication** → **Users** → **Add user**
2. Email: `demo.quality.unrwa@gmail.com` (أو بريدك الحقيقي)
3. Password: `Demo@123456789`
4. فعّل **Auto Confirm User**
5. احفظ

### أو نفّذ SQL

شغّل `supabase-seed.sql` ثم `supabase-profiles-rls.sql` في SQL Editor.

## 3) بعد الرفع على GitHub

ادفع التحديثات إلى GitHub — GitHub Pages يحدّث تلقائياً خلال دقائق.

## 4) تسجيل الدخول

استخدم نفس البريد وكلمة المرور التي أنشأتها في Supabase (وليس `demo@gmail.com`).
