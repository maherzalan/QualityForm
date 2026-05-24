# إنشاء مستخدم demo@gmail.com (بدون SQL)

إذا فشل ملف `supabase-seed.sql`، أنشئ المستخدم من لوحة Supabase:

1. افتح **Authentication** → **Users**
2. اضغط **Add user** → **Create new user**
3. أدخل:
   - **Email:** `demo@gmail.com`
   - **Password:** `Demo@123456789`
4. فعّل **Auto Confirm User**
5. احفظ

ثم نفّذ في SQL Editor (لإنشاء الملف الشخصي فقط):

```sql
INSERT INTO profiles (id, full_name, role, region, job_title)
SELECT id, 'مستخدم تجريبي', 'منسق', 'الوسطى - شرق', 'منسق'
FROM auth.users WHERE email = 'demo@gmail.com'
ON CONFLICT (id) DO NOTHING;
```

## إعدادات مهمة

في **Authentication** → **Providers** → **Email**:

- عطّل **Confirm email** أثناء التطوير (لتجنب فشل الدخول)
