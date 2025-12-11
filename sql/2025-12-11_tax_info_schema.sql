-- =====================================================
-- TAX INFORMATION SCHEMA
-- Bổ sung thông tin thuế cho Customer và Organization
-- Date: 2025-12-11
-- =====================================================

-- 1. Thêm thông tin thuế cho customers
ALTER TABLE customers 
ADD COLUMN IF NOT EXISTS tax_code TEXT,
ADD COLUMN IF NOT EXISTS is_company BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS company_address TEXT;

COMMENT ON COLUMN customers.tax_code IS 'Mã số thuế của khách hàng (nếu là doanh nghiệp)';
COMMENT ON COLUMN customers.is_company IS 'Phân biệt khách hàng là doanh nghiệp hay cá nhân';
COMMENT ON COLUMN customers.company_address IS 'Địa chỉ công ty (để in hóa đơn)';

-- 2. Thêm thông tin thuế mở rộng cho store_settings
ALTER TABLE store_settings
ADD COLUMN IF NOT EXISTS tax_authority TEXT,
ADD COLUMN IF NOT EXISTS tax_department TEXT,
ADD COLUMN IF NOT EXISTS business_license_number TEXT,
ADD COLUMN IF NOT EXISTS business_license_date DATE,
ADD COLUMN IF NOT EXISTS legal_representative TEXT,
ADD COLUMN IF NOT EXISTS accountant_name TEXT,
ADD COLUMN IF NOT EXISTS accountant_phone TEXT;

COMMENT ON COLUMN store_settings.tax_authority IS 'Cơ quan thuế quản lý (VD: Cục Thuế TP.HCM)';
COMMENT ON COLUMN store_settings.tax_department IS 'Chi cục thuế quản lý (VD: Chi cục Thuế Quận 1)';
COMMENT ON COLUMN store_settings.business_license_number IS 'Số giấy phép kinh doanh';
COMMENT ON COLUMN store_settings.business_license_date IS 'Ngày cấp giấy phép';
COMMENT ON COLUMN store_settings.legal_representative IS 'Người đại diện pháp luật';
COMMENT ON COLUMN store_settings.accountant_name IS 'Tên kế toán trưởng';
COMMENT ON COLUMN store_settings.accountant_phone IS 'SĐT kế toán';

-- 3. Thêm cột VAT (thuế GTGT) cho sales và work_orders
ALTER TABLE sales
ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) DEFAULT 10.00,
ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount_before_vat NUMERIC(15,2);

COMMENT ON COLUMN sales.vat_rate IS 'Tỷ lệ thuế GTGT (%)';
COMMENT ON COLUMN sales.vat_amount IS 'Số tiền thuế GTGT';
COMMENT ON COLUMN sales.amount_before_vat IS 'Tiền hàng chưa VAT';

ALTER TABLE work_orders
ADD COLUMN IF NOT EXISTS vat_rate NUMERIC(5,2) DEFAULT 10.00,
ADD COLUMN IF NOT EXISTS vat_amount NUMERIC(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS amount_before_vat NUMERIC(15,2);

COMMENT ON COLUMN work_orders.vat_rate IS 'Tỷ lệ thuế GTGT (%)';
COMMENT ON COLUMN work_orders.vat_amount IS 'Số tiền thuế GTGT';
COMMENT ON COLUMN work_orders.amount_before_vat IS 'Tiền hàng chưa VAT';

-- 4. Tạo bảng lưu lịch sử xuất báo cáo thuế
CREATE TABLE IF NOT EXISTS tax_report_exports (
  id TEXT PRIMARY KEY,
  report_type TEXT NOT NULL, -- 'vat_01', 'vat_02', 'revenue', 'expense'
  period_type TEXT NOT NULL, -- 'month', 'quarter', 'year'
  period_value TEXT NOT NULL, -- '2025-12', 'Q4-2025', '2025'
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_revenue NUMERIC(15,2) DEFAULT 0,
  total_vat NUMERIC(15,2) DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  exported_by UUID REFERENCES profiles(id),
  exported_at TIMESTAMPTZ DEFAULT NOW(),
  file_name TEXT,
  file_format TEXT, -- 'xml', 'excel', 'pdf'
  notes TEXT,
  branch_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE tax_report_exports IS 'Lịch sử xuất báo cáo thuế';

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_tax_exports_period ON tax_report_exports(period_type, period_value);
CREATE INDEX IF NOT EXISTS idx_tax_exports_branch ON tax_report_exports(branch_id);
CREATE INDEX IF NOT EXISTS idx_tax_exports_date ON tax_report_exports(exported_at);

-- RLS policies
ALTER TABLE tax_report_exports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view tax exports of their branch" ON tax_report_exports;
CREATE POLICY "Users can view tax exports of their branch" ON tax_report_exports
  FOR SELECT USING (
    branch_id IN (
      SELECT branch_id FROM profiles WHERE id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Managers and owners can create tax exports" ON tax_report_exports;
CREATE POLICY "Managers and owners can create tax exports" ON tax_report_exports
  FOR INSERT WITH CHECK (
    branch_id IN (
      SELECT branch_id FROM profiles 
      WHERE id = auth.uid() 
      AND role IN ('owner', 'manager', 'accountant')
    )
  );

-- 5. Cập nhật hàm tính toán để tách VAT
-- Function to calculate VAT for existing sales
CREATE OR REPLACE FUNCTION update_existing_sales_vat()
RETURNS void AS $$
BEGIN
  -- Cập nhật cho các sales chưa có thông tin VAT
  UPDATE sales
  SET 
    amount_before_vat = ROUND(total / 1.1, 0), -- Giả sử VAT 10%
    vat_amount = ROUND(total - (total / 1.1), 0),
    vat_rate = 10.00
  WHERE amount_before_vat IS NULL OR vat_amount IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Run once to update existing data
SELECT update_existing_sales_vat();

-- Grant permissions
GRANT SELECT ON tax_report_exports TO authenticated;
GRANT INSERT ON tax_report_exports TO authenticated;
