-- Insert sample store settings with bank information
-- Run this to add bank details to your store settings

-- First, check if store_settings already has data
DO $$ 
BEGIN
  -- If no data exists, insert default row
  IF NOT EXISTS (SELECT 1 FROM store_settings LIMIT 1) THEN
    INSERT INTO store_settings (
      store_name,
      address,
      phone,
      email,
      bank_name,
      bank_account_number,
      bank_account_holder,
      bank_branch,
      work_order_prefix
    )
    VALUES (
      'Nhạn Lâm SmartCare',
      'Phú Lợi B, Xã Long Phú Thuận, Đống Tháp',
      '0947-747-907',
      'ltnsmart2022@gmail.com',
      'LPBank',
      '0944619393',
      'VO THANH LAM',
      'Chi nhánh Đồng Tháp',
      'SC'
    );
  ELSE
    -- If data exists, update it
    UPDATE store_settings SET
      store_name = 'Nhạn Lâm SmartCare',
      address = 'Phú Lợi B, Xã Long Phú Thuận, Đống Tháp',
      phone = '0947-747-907',
      email = 'ltnsmart2022@gmail.com',
      bank_name = 'LPBank',
      bank_account_number = '0944619393',
      bank_account_holder = 'VO THANH LAM',
      bank_branch = 'Chi nhánh Đồng Tháp',
      work_order_prefix = 'SC';
  END IF;
END $$;

-- Verify the data
SELECT 
  store_name,
  phone,
  bank_name,
  bank_account_number,
  bank_account_holder,
  bank_branch
FROM store_settings;

-- Note: To add QR code, upload image to Supabase Storage first
-- Then update the bank_qr_url column:
-- UPDATE store_settings 
-- SET bank_qr_url = 'https://your-supabase-url/storage/v1/object/public/public-assets/qr-code.png';

