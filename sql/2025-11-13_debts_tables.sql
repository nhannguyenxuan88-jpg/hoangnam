-- Create customer_debts table
CREATE TABLE IF NOT EXISTS customer_debts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  phone TEXT,
  license_plate TEXT,
  description TEXT NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  remaining_amount NUMERIC NOT NULL DEFAULT 0,
  created_date DATE NOT NULL DEFAULT CURRENT_DATE,
  branch_id TEXT NOT NULL DEFAULT 'CN1',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create supplier_debts table
CREATE TABLE IF NOT EXISTS supplier_debts (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  description TEXT NOT NULL,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  remaining_amount NUMERIC NOT NULL DEFAULT 0,
  created_date DATE NOT NULL DEFAULT CURRENT_DATE,
  branch_id TEXT NOT NULL DEFAULT 'CN1',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Disable RLS temporarily for testing
ALTER TABLE customer_debts DISABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_debts DISABLE ROW LEVEL SECURITY;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_customer_debts_customer_id ON customer_debts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_debts_branch_id ON customer_debts(branch_id);
CREATE INDEX IF NOT EXISTS idx_customer_debts_remaining ON customer_debts(remaining_amount);

CREATE INDEX IF NOT EXISTS idx_supplier_debts_supplier_id ON supplier_debts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_debts_branch_id ON supplier_debts(branch_id);
CREATE INDEX IF NOT EXISTS idx_supplier_debts_remaining ON supplier_debts(remaining_amount);

-- Add comments
COMMENT ON TABLE customer_debts IS 'Quản lý công nợ khách hàng';
COMMENT ON TABLE supplier_debts IS 'Quản lý công nợ nhà cung cấp';
