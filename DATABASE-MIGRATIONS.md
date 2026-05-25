# هجرات قاعدة البيانات (Migrations)

## الهيكل

```
supabase/
├── migrations/          ← هجرات المخطط (تُطبَّق تلقائياً بالترتيب)
│   ├── 20250101000001_initial_schema.sql
│   ├── 20250101000002_rbac_policies.sql
│   └── 20250101000003_db_functions.sql
└── seeds/
    └── demo_user.sql    ← بيانات تجريبية (اختياري)
```

الملفات القديمة في الجذر (`supabase-rbac-*.sql`) **لم تعد تُستخدم مباشرة** — استخدم نظام الهجرات أعلاه.

---

## الإعداد (مرة واحدة)

### 1) إنشاء ملف `.env`

انسخ من `.env.example` وأضف **DATABASE_URL**:

```
DATABASE_URL=postgresql://postgres.ywpyublgyxwvqwekvydf:YOUR_DB_PASSWORD@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres
```

من: **Supabase → Project Settings → Database → Connect → Session mode** (منفذ 5432)

> على شبكات IPv4 فقط (مثل Windows بدون IPv6)، عنوان `db.[ref].supabase.co` يفشل بـ `ENOTFOUND`.
> استخدم **Session pooler** من اللوحة — لا تخمّن `aws-0`/`aws-1` أو المنطقة.

### 2) تثبيت وتشغيل الهجرات

```bash
npm install
npm run db:migrate
```

أو على Windows: **`migrate.bat`**

### 3) بيانات تجريبية (اختياري)

```bash
npm run db:seed
```

---

## الأوامر

| الأمر | الوصف |
|--------|--------|
| `npm run db:migrate` | تطبيق الهجرات المعلّقة فقط |
| `npm run db:status` | عرض ما طُبِّق وما تبقّى |
| `npm run db:seed` | تشغيل ملفات `supabase/seeds/` |
| `npm start` | هجرات + خادم محلي على المنفذ 8080 |

---

## التحديث التلقائي من المتصفح

| ماذا | كيف |
|------|-----|
| **إنشاء الجداول (DDL)** | ❌ لا يمكن من المتصفح — استخدم `npm run db:migrate` |
| **تعبئة المناطق إن كانت فارغة** | ✅ تلقائياً عبر `db-health.js` → `ensure_regions_seed()` |
| **فحص الجاهزية** | ✅ `check_database_health()` |

عند فتح التطبيق، يُفحص الاتصال ويُعرض تنبيه إذا كانت الهجرات ناقصة.

---

## إضافة هجرة جديدة

1. أنشئ ملفاً بصيغة: `supabase/migrations/YYYYMMDDHHMMSS_وصف.sql`
2. استخدم `CREATE TABLE IF NOT EXISTS` و `ON CONFLICT DO NOTHING` حيث أمكن
3. شغّل: `npm run db:migrate`

---

## GitHub Pages

الموقع المنشور **لا يشغّل** Node — نفّذ الهجرات محلياً قبل النشر:

```bash
npm run db:migrate
```

---

## Supabase CLI (اختياري)

إذا ثبّت [Supabase CLI](https://supabase.com/docs/guides/cli):

```bash
supabase link --project-ref ywpyublgyxwvqwekvydf
supabase db push
```

يمكن مزامنة مجلد `supabase/migrations/` مع المشروع.
