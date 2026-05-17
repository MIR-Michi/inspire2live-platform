-- ============================================================
-- Migration 00009: Admin bootstrap
-- Sets michael.wittinger@gmail.com as PlatformAdmin
-- Adds RLS policies so PlatformAdmin can read/update all profiles
-- ============================================================

-- 1. Promote michael.wittinger@gmail.com to PlatformAdmin
UPDATE profiles
SET role = 'PlatformAdmin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'michael.wittinger@gmail.com'
);

-- 2. Allow PlatformAdmin to read ALL profiles (user management)
DROP POLICY IF EXISTS admin_can_read_all_profiles ON profiles;
DROP POLICY IF EXISTS admin_can_read_all_profiles ON profiles;
CREATE POLICY admin_can_read_all_profiles ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- either it's your own profile (covered by existing policy),
    -- or you are a PlatformAdmin
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles AS p2
      WHERE p2.id = auth.uid() AND p2.role = 'PlatformAdmin'
    )
  );

-- 3. Allow PlatformAdmin to update ANY profile's role field
DROP POLICY IF EXISTS admin_can_update_any_profile ON profiles;
DROP POLICY IF EXISTS admin_can_update_any_profile ON profiles;
CREATE POLICY admin_can_update_any_profile ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles AS p2
      WHERE p2.id = auth.uid() AND p2.role = 'PlatformAdmin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles AS p2
      WHERE p2.id = auth.uid() AND p2.role = 'PlatformAdmin'
    )
  );
