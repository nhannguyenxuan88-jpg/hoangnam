-- RPC function to get all users for owner (bypasses RLS)
-- Only owner can call this function

-- First, create a function to sync auth.users to profiles (for existing users)
CREATE OR REPLACE FUNCTION sync_auth_users_to_profiles()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert missing profiles from auth.users
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
END;
$$;

-- Run sync immediately
SELECT sync_auth_users_to_profiles();

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
  -- Get the caller's role
  SELECT p.role INTO caller_role
  FROM profiles p
  WHERE p.id = auth.uid();
  
  -- Only owner can see all users
  IF caller_role != 'owner' THEN
    RAISE EXCEPTION 'Access denied. Only owner can view all users.';
  END IF;
  
  -- Return all users from profiles
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_all_users_for_owner() TO authenticated;

-- Also create a function to get auth.users info (if needed)
CREATE OR REPLACE FUNCTION get_all_auth_users_for_owner()
RETURNS TABLE (
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  confirmed_at timestamptz
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_role text;
BEGIN
  -- Get the caller's role
  SELECT p.role INTO caller_role
  FROM profiles p
  WHERE p.id = auth.uid();
  
  -- Only owner can see all users
  IF caller_role != 'owner' THEN
    RAISE EXCEPTION 'Access denied. Only owner can view all users.';
  END IF;
  
  -- Return users from auth.users with matching profiles
  RETURN QUERY
  SELECT 
    u.id,
    u.email::text,
    u.created_at,
    u.last_sign_in_at,
    u.confirmed_at
  FROM auth.users u
  LEFT JOIN profiles p ON u.id = p.id
  ORDER BY u.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION get_all_auth_users_for_owner() TO authenticated;

-- Ensure profiles table has proper RLS for owner to view all
-- Owner should be able to see all profiles
DROP POLICY IF EXISTS "Owner can view all profiles" ON profiles;
CREATE POLICY "Owner can view all profiles" ON profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'owner'
    )
  );

-- Owner can update all profiles (for role assignment)
DROP POLICY IF EXISTS "Owner can update all profiles" ON profiles;
CREATE POLICY "Owner can update all profiles" ON profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'owner'
    )
  );

-- Users can view their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile (name, avatar)
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    -- Can only update name and avatar, not role
    (role IS NOT DISTINCT FROM (SELECT role FROM profiles WHERE id = auth.uid()))
  );
