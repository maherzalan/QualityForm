-- ============================================
-- ترقية نظام الصلاحيات v2
-- نفّذ بعد supabase-rbac-migration.sql
-- ============================================

-- profiles: حقول إضافية
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS manager_id UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS phone TEXT;

-- reports: ربط بالمنطقة
ALTER TABLE reports
ADD COLUMN IF NOT EXISTS region_id UUID REFERENCES regions(id);

UPDATE reports r
SET region_id = reg.id
FROM regions reg
WHERE r.region_id IS NULL AND r.region = reg.name;

-- user_region_access (بديل/إضافة لـ report_access)
CREATE TABLE IF NOT EXISTS user_region_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  region_id UUID REFERENCES regions(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, region_id)
);

-- سجل النشاط
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE user_region_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS: profiles
-- ============================================
DROP POLICY IF EXISTS "Users read own profile" ON profiles;
DROP POLICY IF EXISTS "Super admin read all profiles" ON profiles;
DROP POLICY IF EXISTS "Region manager read region profiles" ON profiles;
DROP POLICY IF EXISTS "Users update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins manage profiles" ON profiles;

CREATE POLICY "Users read own profile" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Super admin read all profiles" ON profiles
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_level = 'مدير_عام')
  );

CREATE POLICY "Region manager read region profiles" ON profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles me
      WHERE me.id = auth.uid()
        AND me.user_level = 'مدير_منطقة'
        AND (
          profiles.region_id = me.region_id
          OR profiles.manager_id = auth.uid()
        )
    )
  );

CREATE POLICY "Users update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Admins insert profiles" ON profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_level IN ('مدير_عام', 'مدير_منطقة'))
  );

CREATE POLICY "Admins update profiles" ON profiles
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_level = 'مدير_عام')
    OR (
      EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.user_level = 'مدير_منطقة')
      AND profiles.user_level = 'منسق'
      AND (profiles.manager_id = auth.uid() OR profiles.region_id = (SELECT region_id FROM profiles WHERE id = auth.uid()))
    )
  );

-- ============================================
-- RLS: activity_logs
-- ============================================
DROP POLICY IF EXISTS "Users insert activity" ON activity_logs;
DROP POLICY IF EXISTS "Admins read activity" ON activity_logs;

CREATE POLICY "Users insert activity" ON activity_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read activity" ON activity_logs
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_level IN ('مدير_عام', 'مدير_منطقة'))
  );

-- ============================================
-- RLS: user_region_access
-- ============================================
DROP POLICY IF EXISTS "Super admin manage region access" ON user_region_access;
CREATE POLICY "Super admin manage region access" ON user_region_access
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_level = 'مدير_عام')
  );

-- ============================================
-- RLS: reports — سياسات محدّثة (region_id)
-- ============================================
DROP POLICY IF EXISTS "Reports select by role" ON reports;
DROP POLICY IF EXISTS "Reports update by role" ON reports;
DROP POLICY IF EXISTS "Reports delete by role" ON reports;
DROP POLICY IF EXISTS "super_admin_select_all_reports" ON reports;
DROP POLICY IF EXISTS "region_manager_select_region_reports" ON reports;
DROP POLICY IF EXISTS "coordinator_select_own_reports" ON reports;
DROP POLICY IF EXISTS "coordinator_update_own_reports" ON reports;
DROP POLICY IF EXISTS "manager_update_region_reports" ON reports;
DROP POLICY IF EXISTS "admin_delete_any_report" ON reports;

CREATE POLICY "super_admin_select_all_reports" ON reports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_level = 'مدير_عام')
  );

CREATE POLICY "region_manager_select_region_reports" ON reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.user_level = 'مدير_منطقة'
        AND (
          reports.region_id = p.region_id
          OR reports.region IN (SELECT name FROM regions WHERE id = p.region_id)
        )
    )
  );

CREATE POLICY "coordinator_select_own_reports" ON reports
  FOR SELECT USING (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_level = 'منسق')
  );

-- INSERT للمنشئ
DROP POLICY IF EXISTS "Users can insert own reports" ON reports;
CREATE POLICY "users_insert_own_reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "coordinator_update_own_reports" ON reports
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "manager_update_region_reports" ON reports
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_level = 'مدير_عام')
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.user_level = 'مدير_منطقة'
        AND (reports.region_id = p.region_id OR reports.region IN (SELECT name FROM regions WHERE id = p.region_id))
    )
  );

CREATE POLICY "admin_delete_any_report" ON reports
  FOR DELETE USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND user_level = 'مدير_عام')
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.user_level = 'مدير_منطقة'
        AND (reports.region_id = p.region_id OR reports.region IN (SELECT name FROM regions WHERE id = p.region_id))
    )
  );

SELECT '✅ تم تطبيق ترقية الصلاحيات v2' AS status;
