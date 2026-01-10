-- ============================================
-- SCRIPT TỔNG HỢP: DEMO ĐẦY ĐỦ DỮ LIỆU
-- Chạy file này trong SQL Editor của Supabase Demo
-- Project: motocare-demo (vljriacfxuvtzfbosebx)
-- ============================================

-- 1. KHÁCH HÀNG MẪU
INSERT INTO public.customers (id, name, phone) VALUES
('cust-demo-001', 'Nguyễn Văn An', '0901234567'),
('cust-demo-002', 'Trần Thị Bình', '0912345678'),
('cust-demo-003', 'Lê Hoàng Cường', '0923456789'),
('cust-demo-004', 'Phạm Minh Đức', '0934567890'),
('cust-demo-005', 'Hoàng Thị Em', '0945678901'),
('cust-demo-006', 'Vũ Quang Phúc', '0956789012'),
('cust-demo-007', 'Đặng Thu Hà', '0967890123'),
('cust-demo-008', 'Bùi Văn Kiên', '0978901234')
ON CONFLICT (id) DO NOTHING;

-- 2. DANH MỤC PHỤ TÙNG
INSERT INTO public.categories (id, name, icon, color) VALUES
('cat-demo-01', 'Nhớt xe máy', '🛢️', '#4A90A4'),
('cat-demo-02', 'Lọc gió', '💨', '#50C878'),
('cat-demo-03', 'Bugi', '⚡', '#FFD700'),
('cat-demo-04', 'Dây curoa', '🔗', '#8B4513'),
('cat-demo-05', 'Bố thắng', '🛑', '#DC143C'),
('cat-demo-06', 'Lốp xe', '🛞', '#2F4F4F'),
('cat-demo-07', 'Ắc quy', '🔋', '#228B22'),
('cat-demo-08', 'Đèn xe', '💡', '#FFA500')
ON CONFLICT (id) DO NOTHING;

-- 3. PHỤ TÙNG MẪU
INSERT INTO public.parts (id, name, sku, stock, category, description) VALUES
-- Nhớt
('part-demo-001', 'Nhớt Castrol Power1 10W40 0.8L', 'NHOT-CP1-08', '{"CN1": 50}'::jsonb, 'Nhớt xe máy', 'Nhớt tổng hợp cao cấp cho xe số'),
('part-demo-002', 'Nhớt Shell Advance AX7 1L', 'NHOT-SA7-1L', '{"CN1": 40}'::jsonb, 'Nhớt xe máy', 'Nhớt bán tổng hợp cho xe tay ga'),
('part-demo-003', 'Nhớt Motul 7100 10W40 1L', 'NHOT-MTL-7100', '{"CN1": 25}'::jsonb, 'Nhớt xe máy', 'Nhớt Full Synthetic cao cấp'),

-- Lọc gió
('part-demo-004', 'Lọc gió Wave Alpha', 'LG-WAVE-A', '{"CN1": 30}'::jsonb, 'Lọc gió', 'Lọc gió chính hãng Honda'),
('part-demo-005', 'Lọc gió Air Blade', 'LG-AIRBLADE', '{"CN1": 25}'::jsonb, 'Lọc gió', 'Lọc gió xe Air Blade 125'),
('part-demo-006', 'Lọc gió SH Mode', 'LG-SHMODE', '{"CN1": 20}'::jsonb, 'Lọc gió', 'Lọc gió SH Mode 125'),

-- Bugi
('part-demo-007', 'Bugi NGK CPR8EA-9', 'BG-NGK-CPR8', '{"CN1": 100}'::jsonb, 'Bugi', 'Bugi tiêu chuẩn cho xe số'),
('part-demo-008', 'Bugi Denso Iridium', 'BG-DENSO-IR', '{"CN1": 50}'::jsonb, 'Bugi', 'Bugi Iridium cao cấp'),

-- Dây curoa
('part-demo-009', 'Dây curoa Air Blade 125', 'DC-AB125', '{"CN1": 15}'::jsonb, 'Dây curoa', 'Dây curoa chính hãng Honda'),
('part-demo-010', 'Dây curoa NVX 155', 'DC-NVX155', '{"CN1": 12}'::jsonb, 'Dây curoa', 'Dây curoa chính hãng Yamaha'),

-- Bố thắng
('part-demo-011', 'Bố thắng đĩa Wave RSX', 'BT-WAVE-D', '{"CN1": 40}'::jsonb, 'Bố thắng', 'Bố thắng đĩa trước'),
('part-demo-012', 'Bố thắng đùm Winner', 'BT-WINNER-S', '{"CN1": 35}'::jsonb, 'Bố thắng', 'Bố thắng sau Winner X'),

-- Lốp xe
('part-demo-013', 'Lốp Michelin City Grip 100/90-14', 'LOP-MCG-14', '{"CN1": 8}'::jsonb, 'Lốp xe', 'Lốp cao cấp cho xe tay ga'),
('part-demo-014', 'Lốp IRC NR73 2.50-17', 'LOP-IRC-17', '{"CN1": 10}'::jsonb, 'Lốp xe', 'Lốp xe số phổ thông'),

-- Ắc quy
('part-demo-015', 'Ắc quy GS GTZ5S', 'AQ-GS-5S', '{"CN1": 20}'::jsonb, 'Ắc quy', 'Ắc quy 12V 3.5Ah'),
('part-demo-016', 'Ắc quy Yuasa YTX7A-BS', 'AQ-YUA-7A', '{"CN1": 15}'::jsonb, 'Ắc quy', 'Ắc quy 12V 6Ah')
ON CONFLICT (id) DO NOTHING;

-- 4. NHÀ CUNG CẤP
DO $$
BEGIN
  IF to_regclass('public.suppliers') IS NOT NULL THEN
    INSERT INTO public.suppliers (id, name, phone, address) VALUES
    ('sup-demo-001', 'Công ty TNHH Phụ Tùng Hồng Hà', '0281234567', '123 Nguyễn Văn Linh, Q.7, TP.HCM'),
    ('sup-demo-002', 'Công ty CP Phát Thịnh', '0282345678', '456 Lê Văn Việt, Q.9, TP.HCM'),
    ('sup-demo-003', 'Đại lý Honda chính hãng', '0283456789', '789 Quốc lộ 1A, Bình Tân, TP.HCM')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

-- 5. NHÂN VIÊN
DO $$
BEGIN
  IF to_regclass('public.employees') IS NOT NULL THEN
    -- Schema commonly used in this repo: employees(branch_id, base_salary, start_date, position, ...)
    INSERT INTO public.employees (
      id,
      name,
      phone,
      email,
      position,
      base_salary,
      start_date,
      branch_id,
      status
    ) VALUES
    ('emp-demo-001', 'Nguyễn Văn Tài', '0909111222', 'nguyentai@motocare.vn', 'technician', 8000000, CURRENT_DATE - 120, 'CN1', 'active'),
    ('emp-demo-002', 'Trần Minh Tuấn', '0909333444', 'trantuan@motocare.vn', 'technician', 7500000, CURRENT_DATE - 90, 'CN1', 'active'),
    ('emp-demo-003', 'Lê Thị Hoa', '0909555666', 'lehoa@motocare.vn', 'cashier', 6000000, CURRENT_DATE - 60, 'CN1', 'active')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

-- 6. CÀI ĐẶT CỬA HÀNG
DO $$
BEGIN
  IF to_regclass('public.store_settings') IS NOT NULL THEN
    INSERT INTO public.store_settings (
      id,
      "storeName",
      "storeAddress",
      "storePhone",
      "storeEmail",
      "bankName",
      "bankAccount",
      "bankAccountName"
    ) VALUES (
      'default',
      'Motocare Demo - Trung tâm sửa chữa xe máy',
      '123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
      '0281234567',
      'demo@motocare.vn',
      'Ngân hàng TMCP Ngoại Thương Việt Nam (Vietcombank)',
      '1234567890',
      'CONG TY TNHH MOTOCARE'
    )
    ON CONFLICT (id) DO UPDATE SET
      "storeName" = EXCLUDED."storeName",
      "storeAddress" = EXCLUDED."storeAddress",
      "storePhone" = EXCLUDED."storePhone",
      "storeEmail" = EXCLUDED."storeEmail",
      "bankName" = EXCLUDED."bankName",
      "bankAccount" = EXCLUDED."bankAccount",
      "bankAccountName" = EXCLUDED."bankAccountName";
  END IF;
END;
$$;

-- 7. PHIẾU SỬA CHỮA MẪU
-- Lưu ý quan trọng về tên cột:
-- Trong schema, các cột camelCase được tạo KHÔNG có dấu nháy => Postgres tự hạ về lowercase (vd: customerName -> customername).
-- Vì vậy seed script phải KHÔNG quote tên cột để Postgres tự match đúng.
INSERT INTO public.work_orders (
  id,
  creationDate,
  customerName,
  customerPhone,
  vehicleModel,
  licensePlate,
  status,
  laborCost,
  discount,
  partsUsed,
  notes,
  total,
  branchId,
  paymentStatus,
  paymentMethod,
  totalPaid,
  remainingAmount,
  created_at,
  updated_at
) VALUES
(
  'WO-DEMO-001',
  NOW() - INTERVAL '7 days',
  'Nguyễn Văn An',
  '0901234567',
  'Honda Air Blade 125',
  '59-A1 12345',
  'Hoàn thành',
  50000,
  0,
  '[{"id":"part-demo-001","name":"Nhớt Castrol Power1 10W40 0.8L","quantity":1,"price":120000}]'::jsonb,
  'Thay nhớt + kiểm tra tổng quát',
  170000,
  'CN1',
  'paid',
  'cash',
  170000,
  0,
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days'
),
(
  'WO-DEMO-002',
  NOW() - INTERVAL '5 days',
  'Trần Thị Bình',
  '0912345678',
  'Yamaha NVX 155',
  '59-B2 67890',
  'Hoàn thành',
  100000,
  0,
  '[{"id":"part-demo-010","name":"Dây curoa NVX 155","quantity":1,"price":420000}]'::jsonb,
  'Thay dây curoa',
  520000,
  'CN1',
  'paid',
  'bank_transfer',
  520000,
  0,
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days'
),
(
  'WO-DEMO-003',
  NOW() - INTERVAL '3 days',
  'Lê Hoàng Cường',
  '0923456789',
  'Honda Winner X',
  '59-C3 11111',
  'Hoàn thành',
  150000,
  0,
  '[{"id":"part-demo-008","name":"Bugi Denso Iridium","quantity":1,"price":180000}]'::jsonb,
  'Thay bugi + vệ sinh kim phun',
  330000,
  'CN1',
  'partial',
  'cash',
  200000,
  130000,
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days'
),
(
  'WO-DEMO-004',
  NOW() - INTERVAL '1 day',
  'Phạm Minh Đức',
  '0934567890',
  'Honda SH Mode 125',
  '59-D4 22222',
  'Đang sửa',
  30000,
  0,
  '[{"id":"part-demo-005","name":"Lọc gió Air Blade","quantity":1,"price":75000}]'::jsonb,
  'Thay lọc gió',
  105000,
  'CN1',
  'unpaid',
  NULL,
  0,
  105000,
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
),
(
  'WO-DEMO-005',
  NOW() - INTERVAL '2 hours',
  'Hoàng Thị Em',
  '0945678901',
  'Yamaha Grande',
  '59-E5 33333',
  'Chờ nhận xe',
  50000,
  0,
  '[{"id":"part-demo-015","name":"Ắc quy GS GTZ5S","quantity":1,"price":380000}]'::jsonb,
  'Thay ắc quy',
  430000,
  'CN1',
  'paid',
  'cash',
  430000,
  0,
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '1 hour'
)
ON CONFLICT (id) DO NOTHING;

-- 8. HÓA ĐƠN BÁN LẺ MẪU
INSERT INTO public.sales (
  id,
  date,
  items,
  subtotal,
  discount,
  total,
  customer,
  paymentMethod,
  userId,
  branchId,
  created_at
) VALUES
(
  'SALE-DEMO-001',
  NOW() - INTERVAL '2 days',
  '[{"id":"part-demo-007","name":"Bugi NGK CPR8EA-9","quantity":2,"price":35000}]'::jsonb,
  70000,
  0,
  70000,
  '{"name":"Phạm Minh Đức","phone":"0934567890"}'::jsonb,
  'cash',
  'demo-user',
  'CN1',
  NOW() - INTERVAL '2 days'
),
(
  'SALE-DEMO-002',
  NOW() - INTERVAL '1 day',
  '[{"id":"part-demo-002","name":"Nhớt Shell Advance AX7 1L","quantity":1,"price":145000}]'::jsonb,
  145000,
  0,
  145000,
  '{"name":"Hoàng Thị Em","phone":"0945678901"}'::jsonb,
  'bank_transfer',
  'demo-user',
  'CN1',
  NOW() - INTERVAL '1 day'
),
(
  'SALE-DEMO-003',
  NOW() - INTERVAL '6 hours',
  '[{"id":"part-demo-014","name":"Lốp IRC NR73 2.50-17","quantity":1,"price":320000}]'::jsonb,
  320000,
  0,
  320000,
  '{"name":"Vũ Quang Phúc","phone":"0956789012"}'::jsonb,
  'cash',
  'demo-user',
  'CN1',
  NOW() - INTERVAL '6 hours'
)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- HOÀN TẤT! Kiểm tra kết quả
-- ============================================
SELECT 
  'Khách hàng' as "Loại dữ liệu", 
  COUNT(*)::text as "Số lượng" 
FROM customers WHERE id LIKE 'cust-demo%'

UNION ALL
SELECT 'Danh mục phụ tùng', COUNT(*)::text 
FROM categories WHERE id LIKE 'cat-demo%'

UNION ALL
SELECT 'Phụ tùng', COUNT(*)::text 
FROM parts WHERE id LIKE 'part-demo%'

UNION ALL
SELECT 'Phiếu sửa chữa', COUNT(*)::text 
FROM work_orders WHERE id LIKE 'WO-DEMO%'

UNION ALL
SELECT 'Hóa đơn bán lẻ', COUNT(*)::text 
FROM sales WHERE id LIKE 'SALE-DEMO%';

-- Optional tables (skip quietly if not present)
DO $$
DECLARE
  v_count BIGINT;
BEGIN
  IF to_regclass('public.suppliers') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.suppliers WHERE id LIKE ''sup-demo%''' INTO v_count;
    RAISE NOTICE 'Nhà cung cấp: %', v_count;
  END IF;

  IF to_regclass('public.employees') IS NOT NULL THEN
    EXECUTE 'SELECT COUNT(*) FROM public.employees WHERE id LIKE ''emp-demo%''' INTO v_count;
    RAISE NOTICE 'Nhân viên: %', v_count;
  END IF;
END;
$$;

-- Hiển thị tổng doanh thu từ demo data
SELECT 
  'Tổng doanh thu (demo)' as "Chỉ số",
  TO_CHAR(SUM(total), 'FM999,999,999') || ' đ' as "Giá trị"
FROM (
  SELECT total FROM work_orders WHERE id LIKE 'WO-DEMO%'
  UNION ALL
  SELECT total FROM sales WHERE id LIKE 'SALE-DEMO%'
) combined;
