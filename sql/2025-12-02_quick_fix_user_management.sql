-- Quick fix: Allow owner to view all profiles
-- Run this in Supabase SQL Editor

-- 1. Sync existing auth.users to profiles
INSERT INTO profiles (id, email, name, role, branch_id, created_at)
SELECT 
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  COALESCE(u.raw_user_meta_data->>'role', 'staff'),
  COALESCE(u.raw_user_meta_data->>'branch_id', 'CN1'),
  u.created_at
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- 2. Allow owner to see all profiles
DROP POLICY IF EXISTS "Owner can view all profiles" ON profiles;
CREATE POLICY "Owner can view all profiles" ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'owner'
    )
  );

-- 3. Allow owner to update all profiles
DROP POLICY IF EXISTS "Owner can update all profiles" ON profiles;
CREATE POLICY "Owner can update all profiles" ON profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'owner'
    )
  );

-- 4. Users can view own profile (keep existing)
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- 5. Create RPC for owner to get all users
CREATE OR REPLACE FUNCTION get_all_users_for_owner()
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  role text,
  branch_id text,
  created_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
BEGIN
  SELECT p.role INTO caller_role
  FROM profiles p
  WHERE p.id = auth.uid();
  
  IF caller_role != 'owner' THEN
    RAISE EXCEPTION 'Access denied. Only owner can view all users.';
  END IF;
  
  RETURN QUERY
  SELECT 
    p.id,
    p.email,
    p.name,
    p.role,
    p.branch_id,
    p.created_at
  FROM profiles p
  ORDER BY p.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_users_for_owner() TO authenticated;

-- Verify
SELECT id, email, name, role, branch_id FROM profiles;
