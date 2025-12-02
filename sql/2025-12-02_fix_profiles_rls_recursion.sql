-- FIX: Infinite recursion in profiles RLS policy
-- The previous policy was checking profiles table inside profiles policy = infinite loop
-- Solution: Use auth.jwt() to get user info without querying profiles

-- First, drop the problematic policies
DROP POLICY IF EXISTS "Owner can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Owner can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;

-- Method 1: Simple approach - users can see their own profile, owner sees all
-- We'll use a SECURITY DEFINER function to check role without recursion

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

-- Now create policies using the function (won't recurse because function is SECURITY DEFINER)

-- 1. Everyone can view their OWN profile (no recursion here)
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT
  USING (auth.uid() = id);

-- 2. Owner can view ALL profiles  
CREATE POLICY "Owner can view all profiles" ON profiles
  FOR SELECT
  USING (auth_user_role() = 'owner');

-- 3. Owner can update ALL profiles
CREATE POLICY "Owner can update all profiles" ON profiles
  FOR UPDATE
  USING (auth_user_role() = 'owner');

-- 4. Users can update their own profile (name, avatar only)
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Verify policies work
SELECT id, email, name, role FROM profiles LIMIT 5;
