-- Create loans table
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

-- Create loan_payments table
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

-- Disable RLS temporarily
ALTER TABLE loans DISABLE ROW LEVEL SECURITY;
ALTER TABLE loan_payments DISABLE ROW LEVEL SECURITY;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_loans_branch_id ON loans(branch_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loan_payments_loan_id ON loan_payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_payments_branch_id ON loan_payments(branch_id);

-- Add comments
COMMENT ON TABLE loans IS 'Quản lý các khoản vay';
COMMENT ON TABLE loan_payments IS 'Lịch sử trả nợ vay';
