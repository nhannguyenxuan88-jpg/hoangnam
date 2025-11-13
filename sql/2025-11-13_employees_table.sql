-- Create employees table
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  position TEXT NOT NULL,
  department TEXT,
  base_salary NUMERIC NOT NULL DEFAULT 0,
  allowances NUMERIC DEFAULT 0,
  start_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'terminated')),
  bank_account TEXT,
  bank_name TEXT,
  tax_code TEXT,
  branch_id TEXT NOT NULL DEFAULT 'CN1',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add RLS policies
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read employees in their branch
CREATE POLICY "Users can read employees in their branch"
  ON employees FOR SELECT
  TO authenticated
  USING (branch_id = public.mc_current_branch());

-- Policy: Managers can insert employees
CREATE POLICY "Managers can insert employees"
  ON employees FOR INSERT
  TO authenticated
  WITH CHECK (
    public.mc_is_manager_or_owner() AND
    branch_id = public.mc_current_branch()
  );

-- Policy: Managers can update employees in their branch
CREATE POLICY "Managers can update employees in their branch"
  ON employees FOR UPDATE
  TO authenticated
  USING (
    public.mc_is_manager_or_owner() AND
    branch_id = public.mc_current_branch()
  )
  WITH CHECK (
    public.mc_is_manager_or_owner() AND
    branch_id = public.mc_current_branch()
  );

-- Policy: Owners can delete employees
CREATE POLICY "Owners can delete employees"
  ON employees FOR DELETE
  TO authenticated
  USING (public.mc_is_owner());

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_employees_branch_id ON employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_status ON employees(status);
CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);

-- Add comments
COMMENT ON TABLE employees IS 'Quản lý thông tin nhân viên';
COMMENT ON COLUMN employees.id IS 'Mã nhân viên';
COMMENT ON COLUMN employees.name IS 'Họ tên nhân viên';
COMMENT ON COLUMN employees.base_salary IS 'Lương cơ bản';
COMMENT ON COLUMN employees.allowances IS 'Phụ cấp';
COMMENT ON COLUMN employees.status IS 'Trạng thái: active, inactive, terminated';
