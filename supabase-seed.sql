-- ============================================
-- مستخدم تجريبي + بيانات افتراضية
-- نفّذ في: Supabase → SQL Editor → Run
--
-- البريد: demo.quality.unrwa@gmail.com
-- كلمة المرور: Demo@123456789
-- ملاحظة: demo@gmail.com مرفوض من Supabase Auth API
-- ============================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  demo_user_id uuid := 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
  demo_email text := 'demo.quality.unrwa@gmail.com';
  demo_password text := 'Demo@123456789';
  report_id uuid := 'b1eebc99-9c0b-4ef8-bb6d-6bb9bd380a22';
  encrypted_pw text;
BEGIN
  encrypted_pw := crypt(demo_password, gen_salt('bf', 10));

  -- 1) مستخدم auth (إنشاء أو تحديث كلمة المرور)
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = demo_email) THEN
    UPDATE auth.users
    SET
      encrypted_password = encrypted_pw,
      email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
      updated_at = NOW()
    WHERE email = demo_email;

    SELECT id INTO demo_user_id FROM auth.users WHERE email = demo_email LIMIT 1;
  ELSE
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token,
      is_sso_user,
      is_anonymous
    ) VALUES (
      demo_user_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      demo_email,
      encrypted_pw,
      NOW(),
      NOW(),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"مستخدم تجريبي"}'::jsonb,
      NOW(),
      NOW(),
      '',
      '',
      '',
      '',
      false,
      false
    );
  END IF;

  -- 2) هوية email (مطلوبة لتسجيل الدخول)
  DELETE FROM auth.identities
  WHERE user_id = demo_user_id AND provider = 'email';

  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    demo_user_id,
    demo_user_id::text,
    jsonb_build_object(
      'sub', demo_user_id::text,
      'email', demo_email,
      'email_verified', true,
      'phone_verified', false
    ),
    'email',
    NOW(),
    NOW(),
    NOW()
  );

  -- 3) الملف الشخصي
  INSERT INTO profiles (id, full_name, role, region, job_title, updated_at)
  VALUES (
    demo_user_id,
    'مستخدم تجريبي',
    'منسق',
    'الوسطى - شرق',
    'منسق',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    role = EXCLUDED.role,
    region = EXCLUDED.region,
    job_title = EXCLUDED.job_title,
    updated_at = NOW();

  -- 4) تقرير نموذجي
  IF NOT EXISTS (SELECT 1 FROM reports WHERE id = report_id) THEN
    INSERT INTO reports (
      id, user_id, center_name, region, job_title, specialist_name,
      visit_period, visit_date, entry_date,
      staff_count, student_count, attendance_rate,
      classrooms_count, tents_count, challenges_notes,
      overall_rating, continue_support, final_notes,
      period_start, period_end
    ) VALUES (
      report_id, demo_user_id,
      'مركز رفح النموذجي', 'الوسطى - شرق', 'منسق ضبط جودة', 'أحمد المحمود',
      'صباحية', CURRENT_DATE - 7, CURRENT_DATE - 7,
      18, 420, 87.50, 12, 2,
      'ملاحظات تجريبية على التحديات.',
      4, 'نعم - بأولوية عالية', 'تقرير تجريبي للاختبار.',
      'ديسمبر 2025', 'أبريل 2026'
    );

    INSERT INTO challenges (report_id, description, percentage) VALUES
      (report_id, 'نقص معلمين', 35),
      (report_id, 'ضعف الإنترنت', 22);

    INSERT INTO security_risks (report_id, risk_type, description) VALUES
      (report_id, 'اعتداء لفظي', 'حادثة تم احتواؤها');

    INSERT INTO strategies (report_id, strategy_type, description) VALUES
      (report_id, 'التعلم التعاوني', 'مجموعات عمل صفية');

    INSERT INTO competitions (report_id, name, details) VALUES
      (report_id, 'مسابقة القراءة', '45 مشاركاً');

    INSERT INTO community_participations (report_id, participation_type, outcomes) VALUES
      (report_id, 'مجلس أولياء أمور', 'اجتماع شهري');

    INSERT INTO initiatives (report_id, name, description) VALUES
      (report_id, 'نظافة المركز', 'تحسين البيئة الصفية');

    INSERT INTO success_stories (report_id, title, challenge, solution, impact) VALUES
      (report_id, 'تحسين الحضور', 'انخفاض الحضور', 'متابعة أسبوعية', 'ارتفع الحضور إلى 87%');

    INSERT INTO recommendations (report_id, type, text) VALUES
      (report_id, 'urgent', 'توفير معلمين إضافيين'),
      (report_id, 'medium', 'تدريب على التعلم النشط'),
      (report_id, 'strategic', 'تطوير البنية التحتية');
  END IF;
END $$;

SELECT
  u.id,
  u.email,
  u.email_confirmed_at IS NOT NULL AS email_confirmed,
  (SELECT count(*) FROM auth.identities i WHERE i.user_id = u.id) AS identities_count
FROM auth.users u
WHERE u.email = 'demo.quality.unrwa@gmail.com';

SELECT '✅ جاهز للدخول' AS status, 'demo.quality.unrwa@gmail.com' AS email, 'Demo@123456789' AS password;
