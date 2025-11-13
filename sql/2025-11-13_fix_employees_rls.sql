-- Fix RLS policies for employees table
-- Allow insert when branch function returns null (fallback to CN1)

DROP POLICY IF EXISTS "Managers can insert employees" ON employees;
DROP POLICY IF EXISTS "Managers can update employees in their branch" ON employees;

-- Policy: Managers can insert employees
CREATE POLICY "Managers can insert employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (
    public.mc_is_manager_or_owner() OR
    branch_id = 'CN1'  -- Allow insert to default branch
  );

-- Policy: Managers can update employees in their branch
CREATE POLICY "Managers can update employees in their branch"
  ON employees FOR UPDATE
  TO authenticated
  USING (
    public.mc_is_manager_or_owner() OR
    branch_id = 'CN1'
  )
  WITH CHECK (
    public.mc_is_manager_or_owner() OR
    branch_id = 'CN1'
  );
