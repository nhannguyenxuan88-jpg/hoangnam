-- ===================================================================
-- COMPREHENSIVE DATABASE SETUP - RUN THIS IN SUPABASE SQL EDITOR
-- ===================================================================

-- 1. DEBTS TABLES
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

-- 2. LOANS TABLES
CREATE TABLE IF NOT EXISTS loans (
  id TEXT PRIMARY KEY,
  lender_name TEXT NOT NULL,
  loan_type TEXT NOT NULL CHECK (loan_type IN ('bank', 'personal', 'other')),
  principal NUMERIC NOT NULL DEFAULT 0,
  interest_rate NUMERIC NOT NULL DEFAULT 0,
  term INTEGER NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  remaining_amount NUMERIC NOT NULL DEFAULT 0,
  monthly_payment NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid', 'overdue')),
  purpose TEXT,
  collateral TEXT,
  notes TEXT,
  branch_id TEXT NOT NULL DEFAULT 'CN1',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS loan_payments (
  id TEXT PRIMARY KEY,
  loan_id TEXT NOT NULL,
  payment_date DATE NOT NULL,
  principal_amount NUMERIC NOT NULL DEFAULT 0,
  interest_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  remaining_amount NUMERIC NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'bank')),
  notes TEXT,
  branch_id TEXT NOT NULL DEFAULT 'CN1',
  cash_transaction_id TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 3. DISABLE RLS FOR TESTING
ALTER TABLE customer_debts DISABLE ROW LEVEL SECURITY;
ALTER TABLE supplier_debts DISABLE ROW LEVEL SECURITY;
ALTER TABLE loans DISABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments DISABLE ROW LEVEL SECURITY;

-- 4. CREATE INDEXES
CREATE INDEX IF NOT EXISTS idx_customer_debts_customer_id ON customer_debts(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_debts_branch_id ON customer_debts(branch_id);
CREATE INDEX IF NOT EXISTS idx_supplier_debts_supplier_id ON supplier_debts(supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_debts_branch_id ON supplier_debts(branch_id);
CREATE INDEX IF NOT EXISTS idx_loans_branch_id ON loans(branch_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_id ON loan_payments(loan_id);

-- 5. ADD COMMENTS
COMMENT ON TABLE customer_debts IS 'Quản lý công nợ khách hàng';
COMMENT ON TABLE supplier_debts IS 'Quản lý công nợ nhà cung cấp';
COMMENT ON TABLE loans IS 'Quản lý các khoản vay';
COMMENT ON TABLE loan_payments IS 'Lịch sử trả nợ vay';

-- DONE! All tables created successfully.
