-- Kiểm tra vấn đề stock không giảm khi xuất hàng trong phiếu sửa chữa
-- Ngày: 2025-12-08

-- Bước 1: Kiểm tra inventory_transactions cho SKU NHB35P
SELECT 
  it.id,
  it.type,
  it."partId",
  it."partName",
  it.quantity,
  it.date,
  it.notes,
  p.stock as current_stock
FROM inventory_transactions it
LEFT JOIN parts p ON it."partId" = p.id
WHERE it."partName" LIKE '%NHB35P%'
  OR p.sku = 'NHB35P'
ORDER BY it.date DESC
LIMIT 20;

-- Bước 2: Kiểm tra work_order_parts (phụ tùng trong phiếu sửa chữa)
-- Tìm các phiếu sửa chữa có dùng sản phẩm NHB35P
SELECT 
  wo.id as work_order_id,
  wo."workOrderCode",
  wo.status,
  wo.date,
  wop.part_name,
  wop.quantity,
  wop.unit_price
FROM work_orders wo
JOIN work_order_parts wop ON wo.id = wop.work_order_id
WHERE wop.part_name LIKE '%NHB35P%'
ORDER BY wo.date DESC
LIMIT 10;

-- Bước 3: Kiểm tra xem có ghi "Xuất kho" trong inventory_transactions không
-- Khi thanh toán phiếu sửa chữa, phải có record "Xuất kho"
SELECT 
  COUNT(*) as xuatkho_count,
  SUM(quantity) as total_quantity
FROM inventory_transactions
WHERE type = 'Xuất kho'
  AND "partName" LIKE '%NHB35P%'
  AND date >= '2025-12-06';

-- Bước 4: Tìm tất cả phiếu sửa chữa đã thanh toán trong 7 ngày qua
-- Kiểm tra xem có ghi xuất kho không
SELECT 
  wo.id,
  wo."workOrderCode",
  wo.status,
  wo.date,
  wo."totalAmount",
  COUNT(wop.id) as parts_count,
  (
    SELECT COUNT(*) 
    FROM inventory_transactions it
    WHERE it.notes LIKE '%' || wo."workOrderCode" || '%'
      AND it.type = 'Xuất kho'
  ) as xuatkho_records
FROM work_orders wo
LEFT JOIN work_order_parts wop ON wo.id = wop.work_order_id
WHERE wo.status IN ('Đã sửa xong', 'Trả máy')
  AND wo.date >= NOW() - INTERVAL '7 days'
GROUP BY wo.id, wo."workOrderCode", wo.status, wo.date, wo."totalAmount"
ORDER BY wo.date DESC
LIMIT 20;

-- Bước 5: Kiểm tra chi tiết phiếu SC-20251206-673440
SELECT 
  wo.id,
  wo."workOrderCode",
  wo.status,
  wop.part_name,
  wop.quantity,
  wop.unit_price,
  it.type as inventory_type,
  it.quantity as inventory_quantity
FROM work_orders wo
JOIN work_order_parts wop ON wo.id = wop.work_order_id
LEFT JOIN inventory_transactions it ON (
  it.notes LIKE '%' || wo."workOrderCode" || '%'
  AND it."partName" = wop.part_name
  AND it.type = 'Xuất kho'
)
WHERE wo."workOrderCode" = 'SC-20251206-673440';

-- Bước 6: Fix thủ công - Tạo record "Xuất kho" cho phiếu SC-20251206-673440
-- CHỈ CHẠY NẾU KIỂM TRA Ở BƯỚC 5 KHÔNG CÓ RECORD XUẤT KHO

/*
DO $$
DECLARE
  v_part_id_nap_sau TEXT;
  v_part_id_bo_nap TEXT;
BEGIN
  -- Lấy part ID của 2 sản phẩm
  SELECT id INTO v_part_id_nap_sau FROM parts WHERE name LIKE '%Nắp sau tay lái%' AND sku = 'NHB35P' LIMIT 1;
  SELECT id INTO v_part_id_bo_nap FROM parts WHERE name LIKE '%Bộ nắp trước tay lái%' AND sku = 'NHB35P' LIMIT 1;

  -- Tạo record xuất kho cho Nắp sau tay lái (1 cái, giá 345.000)
  IF v_part_id_nap_sau IS NOT NULL THEN
    INSERT INTO inventory_transactions (
      id, type, "partId", "partName", quantity, date, "unitPrice", "totalPrice", "branchId", notes
    ) VALUES (
      gen_random_uuid(),
      'Xuất kho',
      v_part_id_nap_sau,
      'Nắp sau tay lái "NHB35P"',
      1,
      '2025-12-06 12:00:00',
      345000,
      345000,
      'CN1',
      'Xuất theo phiếu sửa chữa SC-20251206-673440'
    );
    RAISE NOTICE 'Đã tạo xuất kho cho Nắp sau';
  END IF;

  -- Tạo record xuất kho cho Bộ nắp trước tay lái (1 cái, giá 285.000)
  IF v_part_id_bo_nap IS NOT NULL THEN
    INSERT INTO inventory_transactions (
      id, type, "partId", "partName", quantity, date, "unitPrice", "totalPrice", "branchId", notes
    ) VALUES (
      gen_random_uuid(),
      'Xuất kho',
      v_part_id_bo_nap,
      'Bộ nắp trước tay lái "NHB35P"',
      1,
      '2025-12-06 12:00:00',
      285000,
      285000,
      'CN1',
      'Xuất theo phiếu sửa chữa SC-20251206-673440'
    );
    RAISE NOTICE 'Đã tạo xuất kho cho Bộ nắp trước';
  END IF;
END $$;
*/
