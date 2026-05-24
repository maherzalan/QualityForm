-- ⚠️ مُهمَل — استخدم supabase/migrations/ و npm run db:migrate (DATABASE-MIGRATIONS.md)
-- ============================================
-- صلاحيات متعددة المستويات + سجل البريد
-- نفّذ في Supabase SQL Editor
-- ============================================

-- 1) جدول المناطق
CREATE TABLE IF NOT EXISTS regions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO regions (name, code) VALUES
  ('الوسطى - شرق', 'CENTER_EAST'),
  ('الوسطى - غرب', 'CENTER_WEST'),
  ('الجنوبية - خانيونس', 'SOUTH_KHAN_YOUNIS'),
  ('الشمالية', 'NORTH'),
  ('غزة', 'GAZA')
ON CONFLICT (name) DO NOTHING;

-- 2) تحديث profiles
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id),
ADD COLUMN IF NOT EXISTS user_level TEXT CHECK (user_level IN ('مدير_عام', 'مدير_منطقة', 'منسق')) DEFAULT 'منسق',
ADD COLUMN IF NOT EXISTS email TEXT;

-- ربط المناطق النصية القديمة
UPDATE profiles p
SET region_id = r.id
FROM regions r
WHERE p.region_id IS NULL AND p.region = r.name;

-- 3) صلاحيات وصول إضافية للمديرين
CREATE TABLE IF NOT EXISTS report_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  region_id UUID REFERENCES regions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, region_id)
);

-- 4) سجل البريد
CREATE TABLE IF NOT EXISTS email_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES reports(id) ON DELETE CASCADE,
  sent_by UUID REFERENCES profiles(id),
  sent_to TEXT NOT NULL,
  subject TEXT,
  sent_at TIMESTAMP DEFAULT NOW(),
  status TEXT CHECK (status IN ('success', 'failed')),
  error_message TEXT
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE report_access ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS: regions (قراءة للجميع المسجلين)
-- ============================================
DROP POLICY IF EXISTS "Authenticated can read regions" ON regions;
CREATE POLICY "Authenticated can read regions" ON regions
  FOR SELECT TO authenticated USING (true);

-- ============================================
-- RLS: report_access
-- ============================================
DROP POLICY IF EXISTS "Users manage own report_access" ON report_access;
CREATE POLICY "Users manage own report_access" ON report_access
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Super admin read report_access" ON report_access;
CREATE POLICY "Super admin read report_access" ON report_access
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_level = 'مدير_عام')
  );

-- ============================================
-- RLS: email_logs
-- ============================================
DROP POLICY IF EXISTS "Users insert own email logs" ON email_logs;
CREATE POLICY "Users insert own email logs" ON email_logs
  FOR INSERT WITH CHECK (auth.uid() = sent_by);

DROP POLICY IF EXISTS "Users read related email logs" ON email_logs;
CREATE POLICY "Users read related email logs" ON email_logs
  FOR SELECT USING (
    sent_by = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_level IN ('مدير_عام', 'مدير_منطقة'))
  );

-- ============================================
-- RLS: reports — استبدال سياسات SELECT/UPDATE/DELETE
-- ============================================
DROP POLICY IF EXISTS "Users can view own reports" ON reports;
DROP POLICY IF EXISTS "Super admin can view all reports" ON reports;
DROP POLICY IF EXISTS "Region manager can view region reports" ON reports;
DROP POLICY IF EXISTS "Users can update own reports" ON reports;
DROP POLICY IF EXISTS "Admin or owner can update reports" ON reports;
DROP POLICY IF EXISTS "Users can delete own reports" ON reports;
DROP POLICY IF EXISTS "Admin or owner can delete reports" ON reports;

-- INSERT: المنشئ فقط (كما كان)
-- SELECT: منسق = تقاريره | مدير منطقة = منطقته | مدير عام = الكل
CREATE POLICY "Reports select by role" ON reports
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_level = 'مدير_عام')
    OR EXISTS (
      SELECT 1 FROM profiles p
      JOIN regions r ON r.id = p.region_id
      WHERE p.id = auth.uid()
        AND p.user_level = 'مدير_منطقة'
        AND reports.region = r.name
    )
  );

CREATE POLICY "Reports update by role" ON reports
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_level = 'مدير_عام')
  );

CREATE POLICY "Reports delete by role" ON reports
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_level = 'مدير_عام')
  );

-- ============================================
-- ترقية مستخدم إلى مدير عام (مثال — غيّر البريد)
-- ============================================
-- UPDATE profiles SET user_level = 'مدير_عام' WHERE email = 'your@email.com';

SELECT '✅ تم تطبيق هيكل الصلاحيات' AS status;
