-- Employee Advance Management Schema
-- Chi tiết: Quản lý ứng lương nhân viên với trả góp

-- Table: employee_advances
CREATE TABLE IF NOT EXISTS employee_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id TEXT NOT NULL, -- Changed from UUID to TEXT to match employees table
  employee_name TEXT NOT NULL,
  advance_amount NUMERIC(12, 2) NOT NULL CHECK (advance_amount > 0),
  advance_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reason TEXT,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'transfer')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'paid')) DEFAULT 'pending',
  approved_by TEXT,
  approved_date TIMESTAMPTZ,
  
  -- Trả góp
  is_installment BOOLEAN NOT NULL DEFAULT FALSE,
  installment_months INTEGER CHECK (installment_months > 0 AND installment_months <= 36),
  monthly_deduction NUMERIC(12, 2) CHECK (monthly_deduction >= 0),
  remaining_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  
  branch_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

-- Table: employee_advance_payments
-- Lịch sử thanh toán trả góp hàng tháng
CREATE TABLE IF NOT EXISTS employee_advance_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  advance_id UUID NOT NULL REFERENCES employee_advances(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL, -- Changed from UUID to TEXT to match employees table
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  payment_month TEXT NOT NULL, -- Format: YYYY-MM
  payroll_record_id UUID, -- Link to payroll record if exists
  notes TEXT,
  branch_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_employee_advances_employee_id ON employee_advances(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_advances_branch_id ON employee_advances(branch_id);
CREATE INDEX IF NOT EXISTS idx_employee_advances_status ON employee_advances(status);
CREATE INDEX IF NOT EXISTS idx_employee_advances_advance_date ON employee_advances(advance_date DESC);

CREATE INDEX IF NOT EXISTS idx_employee_advance_payments_advance_id ON employee_advance_payments(advance_id);
CREATE INDEX IF NOT EXISTS idx_employee_advance_payments_employee_id ON employee_advance_payments(employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_advance_payments_payment_month ON employee_advance_payments(payment_month);

-- Trigger: Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_employee_advance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_employee_advances_updated_at
  BEFORE UPDATE ON employee_advances
  FOR EACH ROW
  EXECUTE FUNCTION update_employee_advance_updated_at();

-- Trigger: Cập nhật remaining_amount và paid_amount khi có payment
CREATE OR REPLACE FUNCTION update_advance_amounts_on_payment()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE employee_advances
  SET 
    paid_amount = paid_amount + NEW.amount,
    remaining_amount = remaining_amount - NEW.amount,
    updated_at = NOW()
  WHERE id = NEW.advance_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_advance_on_payment
  AFTER INSERT ON employee_advance_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_advance_amounts_on_payment();

-- RLS Policies
ALTER TABLE employee_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_advance_payments ENABLE ROW LEVEL SECURITY;

-- Policy: Owner/Manager có thể xem tất cả
CREATE POLICY "Owner/Manager can view all employee advances"
  ON employee_advances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'manager')
    )
  );

-- Policy: Nhân viên chỉ xem ứng lương của mình (nếu có user_id mapping)
-- Tạm thời disable policy này nếu employees chưa có user_id
-- CREATE POLICY "Employees can view their own advances"
--   ON employee_advances FOR SELECT
--   USING (
--     employee_id IN (
--       SELECT id FROM employees
--       WHERE user_id = auth.uid()
--     )
--   );

-- Policy: Owner/Manager có thể tạo ứng lương
CREATE POLICY "Owner/Manager can create employee advances"
  ON employee_advances FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'manager')
    )
  );

-- Policy: Owner/Manager có thể update (duyệt/từ chối)
CREATE POLICY "Owner/Manager can update employee advances"
  ON employee_advances FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'manager')
    )
  );

-- Policy: Owner/Manager có thể delete
CREATE POLICY "Owner/Manager can delete employee advances"
  ON employee_advances FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'manager')
    )
  );

-- Policies cho employee_advance_payments
CREATE POLICY "Owner/Manager can view all payments"
  ON employee_advance_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'manager')
    )
  );

-- CREATE POLICY "Employees can view their own payments"
--   ON employee_advance_payments FOR SELECT
--   USING (
--     employee_id IN (
--       SELECT id FROM employees
--       WHERE user_id = auth.uid()
--     )
--   );

CREATE POLICY "Owner/Manager can manage payments"
  ON employee_advance_payments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('owner', 'manager')
    )
  );

-- View: Tổng hợp thông tin ứng lương
CREATE OR REPLACE VIEW employee_advances_summary AS
SELECT 
  ea.*,
  e.position as employee_position,
  e.department as employee_department,
  COUNT(eap.id) as payment_count,
  COALESCE(SUM(eap.amount), 0) as total_paid_via_payments
FROM employee_advances ea
LEFT JOIN employees e ON ea.employee_id = e.id::text
LEFT JOIN employee_advance_payments eap ON ea.id = eap.advance_id
GROUP BY ea.id, e.position, e.department;

-- Comments
COMMENT ON TABLE employee_advances IS 'Quản lý các đơn ứng lương của nhân viên';
COMMENT ON TABLE employee_advance_payments IS 'Lịch sử thanh toán trả góp ứng lương hàng tháng';
COMMENT ON COLUMN employee_advances.payment_method IS 'Nguồn tiền: cash (tiền mặt) hoặc transfer (chuyển khoản)';
COMMENT ON COLUMN employee_advances.is_installment IS 'TRUE nếu nhân viên chọn trả góp hàng tháng';
COMMENT ON COLUMN employee_advances.monthly_deduction IS 'Số tiền trừ lương hàng tháng nếu chọn trả góp';
