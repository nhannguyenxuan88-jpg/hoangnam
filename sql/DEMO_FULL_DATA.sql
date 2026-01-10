-- ============================================
-- SCRIPT TỔNG HỢP: DEMO ĐẦY ĐỦ DỮ LIỆU
-- Chạy file này trong SQL Editor của Supabase Demo
-- Project: motocare-demo (vljriacfxuvtzfbosebx)
-- ============================================

-- 1. KHÁCH HÀNG MẪU
INSERT INTO public.customers (id, name, phone, email, address, "totalSpent", "createdAt") VALUES
('cust-demo-001', 'Nguyễn Văn An', '0901234567', 'nguyenvanan@gmail.com', '123 Nguyễn Huệ, Q.1, TP.HCM', 0, NOW()),
('cust-demo-002', 'Trần Thị Bình', '0912345678', 'tranbinhthi@gmail.com', '456 Lê Lợi, Q.1, TP.HCM', 0, NOW()),
('cust-demo-003', 'Lê Hoàng Cường', '0923456789', 'lehoangcuong@gmail.com', '789 Điện Biên Phủ, Q.3, TP.HCM', 0, NOW()),
('cust-demo-004', 'Phạm Minh Đức', '0934567890', 'phamminhduc@gmail.com', '321 Võ Văn Tần, Q.3, TP.HCM', 0, NOW()),
('cust-demo-005', 'Hoàng Thị Em', '0945678901', 'hoangthiem@gmail.com', '654 Trường Sa, Q.Phú Nhuận, TP.HCM', 0, NOW()),
('cust-demo-006', 'Vũ Quang Phúc', '0956789012', 'vuquangphuc@gmail.com', '987 CMT8, Q.10, TP.HCM', 0, NOW()),
('cust-demo-007', 'Đặng Thu Hà', '0967890123', 'dangthuha@gmail.com', '147 Hai Bà Trưng, Q.1, TP.HCM', 0, NOW()),
('cust-demo-008', 'Bùi Văn Kiên', '0978901234', 'buivankien@gmail.com', '258 Nguyễn Thị Minh Khai, Q.3, TP.HCM', 0, NOW())
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
INSERT INTO public.parts (id, name, sku, stock, category, description, price, "costPrice", "branchId") VALUES
-- Nhớt
('part-demo-001', 'Nhớt Castrol Power1 10W40 0.8L', 'NHOT-CP1-08', '{"CN1": 50}'::jsonb, 'Nhớt xe máy', 'Nhớt tổng hợp cao cấp cho xe số', 120000, 90000, 'CN1'),
('part-demo-002', 'Nhớt Shell Advance AX7 1L', 'NHOT-SA7-1L', '{"CN1": 40}'::jsonb, 'Nhớt xe máy', 'Nhớt bán tổng hợp cho xe tay ga', 145000, 110000, 'CN1'),
('part-demo-003', 'Nhớt Motul 7100 10W40 1L', 'NHOT-MTL-7100', '{"CN1": 25}'::jsonb, 'Nhớt xe máy', 'Nhớt Full Synthetic cao cấp', 280000, 220000, 'CN1'),

-- Lọc gió
('part-demo-004', 'Lọc gió Wave Alpha', 'LG-WAVE-A', '{"CN1": 30}'::jsonb, 'Lọc gió', 'Lọc gió chính hãng Honda', 65000, 45000, 'CN1'),
('part-demo-005', 'Lọc gió Air Blade', 'LG-AIRBLADE', '{"CN1": 25}'::jsonb, 'Lọc gió', 'Lọc gió xe Air Blade 125', 75000, 55000, 'CN1'),
('part-demo-006', 'Lọc gió SH Mode', 'LG-SHMODE', '{"CN1": 20}'::jsonb, 'Lọc gió', 'Lọc gió SH Mode 125', 85000, 65000, 'CN1'),

-- Bugi
('part-demo-007', 'Bugi NGK CPR8EA-9', 'BG-NGK-CPR8', '{"CN1": 100}'::jsonb, 'Bugi', 'Bugi tiêu chuẩn cho xe số', 35000, 25000, 'CN1'),
('part-demo-008', 'Bugi Denso Iridium', 'BG-DENSO-IR', '{"CN1": 50}'::jsonb, 'Bugi', 'Bugi Iridium cao cấp', 180000, 140000, 'CN1'),

-- Dây curoa
('part-demo-009', 'Dây curoa Air Blade 125', 'DC-AB125', '{"CN1": 15}'::jsonb, 'Dây curoa', 'Dây curoa chính hãng Honda', 380000, 300000, 'CN1'),
('part-demo-010', 'Dây curoa NVX 155', 'DC-NVX155', '{"CN1": 12}'::jsonb, 'Dây curoa', 'Dây curoa chính hãng Yamaha', 420000, 340000, 'CN1'),

-- Bố thắng
('part-demo-011', 'Bố thắng đĩa Wave RSX', 'BT-WAVE-D', '{"CN1": 40}'::jsonb, 'Bố thắng', 'Bố thắng đĩa trước', 95000, 70000, 'CN1'),
('part-demo-012', 'Bố thắng đùm Winner', 'BT-WINNER-S', '{"CN1": 35}'::jsonb, 'Bố thắng', 'Bố thắng sau Winner X', 120000, 90000, 'CN1'),

-- Lốp xe
('part-demo-013', 'Lốp Michelin City Grip 100/90-14', 'LOP-MCG-14', '{"CN1": 8}'::jsonb, 'Lốp xe', 'Lốp cao cấp cho xe tay ga', 850000, 680000, 'CN1'),
('part-demo-014', 'Lốp IRC NR73 2.50-17', 'LOP-IRC-17', '{"CN1": 10}'::jsonb, 'Lốp xe', 'Lốp xe số phổ thông', 320000, 250000, 'CN1'),

-- Ắc quy
('part-demo-015', 'Ắc quy GS GTZ5S', 'AQ-GS-5S', '{"CN1": 20}'::jsonb, 'Ắc quy', 'Ắc quy 12V 3.5Ah', 380000, 300000, 'CN1'),
('part-demo-016', 'Ắc quy Yuasa YTX7A-BS', 'AQ-YUA-7A', '{"CN1": 15}'::jsonb, 'Ắc quy', 'Ắc quy 12V 6Ah', 520000, 420000, 'CN1')
ON CONFLICT (id) DO NOTHING;

-- 4. NHÀ CUNG CẤP
INSERT INTO public.suppliers (id, name, phone, address, email, notes) VALUES
('sup-demo-001', 'Công ty TNHH Phụ Tùng Hồng Hà', '0281234567', '123 Nguyễn Văn Linh, Q.7, TP.HCM', 'contact@honghaauto.vn', 'Nhà cung cấp chính'),
('sup-demo-002', 'Công ty CP Phát Thịnh', '0282345678', '456 Lê Văn Việt, Q.9, TP.HCM', 'info@phatthinhparts.vn', 'Nhà cung cấp phụ'),
('sup-demo-003', 'Đại lý Honda chính hãng', '0283456789', '789 Quốc lộ 1A, Bình Tân, TP.HCM', 'honda@dealer.vn', 'Đại lý chính hãng')
ON CONFLICT (id) DO NOTHING;

-- 5. NHÂN VIÊN
INSERT INTO public.employees (id, name, phone, role, salary, "branchId", active, email) VALUES
('emp-demo-001', 'Nguyễn Văn Tài', '0909111222', 'technician', 8000000, 'CN1', true, 'nguyentai@motocare.vn'),
('emp-demo-002', 'Trần Minh Tuấn', '0909333444', 'technician', 7500000, 'CN1', true, 'trantuan@motocare.vn'),
('emp-demo-003', 'Lê Thị Hoa', '0909555666', 'cashier', 6000000, 'CN1', true, 'lehoa@motocare.vn')
ON CONFLICT (id) DO NOTHING;

-- 6. CÀI ĐẶT CỬA HÀNG
INSERT INTO public.store_settings (
  id, 
  "storeName", 
  "storeAddress", 
  "storePhone", 
  "storeEmail",
  "bankName",
  "bankAccount",
  "bankAccountName",
  "taxId"
) VALUES (
  'default',
  'Motocare Demo - Trung tâm sửa chữa xe máy',
  '123 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
  '0281234567',
  'demo@motocare.vn',
  'Ngân hàng TMCP Ngoại Thương Việt Nam (Vietcombank)',
  '1234567890',
  'CONG TY TNHH MOTOCARE',
  '0123456789'
)
ON CONFLICT (id) DO UPDATE SET
  "storeName" = EXCLUDED."storeName",
  "storeAddress" = EXCLUDED."storeAddress",
  "storePhone" = EXCLUDED."storePhone",
  "storeEmail" = EXCLUDED."storeEmail",
  "bankName" = EXCLUDED."bankName",
  "bankAccount" = EXCLUDED."bankAccount",
  "bankAccountName" = EXCLUDED."bankAccountName",
  "taxId" = EXCLUDED."taxId";

-- 7. PHIẾU SỬA CHỮA MẪU
INSERT INTO public.work_orders (
  id,
  "customerName",
  "customerPhone",
  "vehiclePlate",
  "vehicleModel",
  "partsUsed",
  "additionalServices",
  "totalAmount",
  "paidAmount",
  "paymentStatus",
  status,
  "branchId",
  "createdAt",
  "updatedAt"
) VALUES
-- Phiếu đã hoàn thành và thanh toán đủ
(
  'WO-DEMO-001',
  'Nguyễn Văn An',
  '0901234567',
  '59-A1 12345',
  'Honda Air Blade 125',
  '[{"id": "part-demo-001", "name": "Nhớt Castrol Power1 10W40 0.8L", "quantity": 1, "price": 120000, "costPrice": 90000}]'::jsonb,
  '[{"name": "Thay nhớt", "price": 50000, "costPrice": 30000}]'::jsonb,
  170000,
  170000,
  'paid',
  'completed',
  'CN1',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days'
),
-- Phiếu đã hoàn thành và thanh toán đủ
(
  'WO-DEMO-002',
  'Trần Thị Bình',
  '0912345678',
  '59-B2 67890',
  'Yamaha NVX 155',
  '[{"id": "part-demo-010", "name": "Dây curoa NVX 155", "quantity": 1, "price": 420000, "costPrice": 340000}]'::jsonb,
  '[{"name": "Thay dây curoa", "price": 100000, "costPrice": 60000}, {"name": "Kiểm tra hệ thống truyền động", "price": 0, "costPrice": 0}]'::jsonb,
  520000,
  520000,
  'paid',
  'completed',
  'CN1',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days'
),
-- Phiếu đã hoàn thành nhưng thiếu tiền
(
  'WO-DEMO-003',
  'Lê Hoàng Cường',
  '0923456789',
  '59-C3 11111',
  'Honda Winner X',
  '[{"id": "part-demo-008", "name": "Bugi Denso Iridium", "quantity": 1, "price": 180000, "costPrice": 140000}]'::jsonb,
  '[{"name": "Thay bugi", "price": 30000, "costPrice": 20000}, {"name": "Vệ sinh kim phun xăng", "price": 120000, "costPrice": 80000}]'::jsonb,
  330000,
  200000,
  'partial',
  'completed',
  'CN1',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days'
),
-- Phiếu đang trong quá trình sửa
(
  'WO-DEMO-004',
  'Phạm Minh Đức',
  '0934567890',
  '59-D4 22222',
  'Honda SH Mode 125',
  '[{"id": "part-demo-005", "name": "Lọc gió Air Blade", "quantity": 1, "price": 75000, "costPrice": 55000}]'::jsonb,
  '[{"name": "Thay lọc gió", "price": 30000, "costPrice": 20000}]'::jsonb,
  105000,
  0,
  'unpaid',
  'in_progress',
  'CN1',
  NOW() - INTERVAL '1 day',
  NOW() - INTERVAL '1 day'
),
-- Phiếu chờ nhận xe
(
  'WO-DEMO-005',
  'Hoàng Thị Em',
  '0945678901',
  '59-E5 33333',
  'Yamaha Grande',
  '[{"id": "part-demo-015", "name": "Ắc quy GS GTZ5S", "quantity": 1, "price": 380000, "costPrice": 300000}]'::jsonb,
  '[{"name": "Thay ắc quy", "price": 50000, "costPrice": 30000}]'::jsonb,
  430000,
  430000,
  'paid',
  'ready',
  'CN1',
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '1 hour'
)
ON CONFLICT (id) DO NOTHING;

-- 8. HÓA ĐƠN BÁN LẺ MẪU
INSERT INTO public.sales (
  id,
  "saleCode",
  items,
  "totalAmount",
  "paidAmount",
  "paymentMethod",
  "customerName",
  "customerPhone",
  status,
  "branchId",
  "createdAt"
) VALUES
-- Bán bugi
(
  'SALE-DEMO-001',
  'BH001',
  '[{"id": "part-demo-007", "name": "Bugi NGK CPR8EA-9", "quantity": 2, "price": 35000, "costPrice": 25000}]'::jsonb,
  70000,
  70000,
  'cash',
  'Phạm Minh Đức',
  '0934567890',
  'completed',
  'CN1',
  NOW() - INTERVAL '2 days'
),
-- Bán nhớt
(
  'SALE-DEMO-002',
  'BH002',
  '[{"id": "part-demo-002", "name": "Nhớt Shell Advance AX7 1L", "quantity": 1, "price": 145000, "costPrice": 110000}]'::jsonb,
  145000,
  145000,
  'bank_transfer',
  'Hoàng Thị Em',
  '0945678901',
  'completed',
  'CN1',
  NOW() - INTERVAL '1 day'
),
-- Bán lốp xe
(
  'SALE-DEMO-003',
  'BH003',
  '[{"id": "part-demo-014", "name": "Lốp IRC NR73 2.50-17", "quantity": 1, "price": 320000, "costPrice": 250000}]'::jsonb,
  320000,
  320000,
  'cash',
  'Vũ Quang Phúc',
  '0956789012',
  'completed',
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
SELECT 'Nhà cung cấp', COUNT(*)::text 
FROM suppliers WHERE id LIKE 'sup-demo%'

UNION ALL
SELECT 'Nhân viên', COUNT(*)::text 
FROM employees WHERE id LIKE 'emp-demo%'

UNION ALL
SELECT 'Phiếu sửa chữa', COUNT(*)::text 
FROM work_orders WHERE id LIKE 'WO-DEMO%'

UNION ALL
SELECT 'Hóa đơn bán lẻ', COUNT(*)::text 
FROM sales WHERE id LIKE 'SALE-DEMO%';

-- Hiển thị tổng doanh thu từ demo data
SELECT 
  'Tổng doanh thu (demo)' as "Chỉ số",
  TO_CHAR(SUM("totalAmount"), 'FM999,999,999') || ' đ' as "Giá trị"
FROM (
  SELECT "totalAmount" FROM work_orders WHERE id LIKE 'WO-DEMO%'
  UNION ALL
  SELECT "totalAmount" FROM sales WHERE id LIKE 'SALE-DEMO%'
) combined;
