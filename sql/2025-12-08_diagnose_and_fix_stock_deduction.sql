-- =============================================================================
-- SỬA LỖI: Stock không giảm khi bán hàng trong phiếu sửa chữa
-- =============================================================================
-- Ngày: 2025-12-08
-- 
-- VẤN ĐỀ:
-- - Sản phẩm đã bán trong work order nhưng vẫn còn tồn kho
-- - Không có record "Xuất kho" trong inventory_transactions
-- - Function work_order_complete_payment chưa có logic ngăn trừ kho 2 lần
--
-- Script này sẽ TỰ ĐỘNG:
-- 1. Tạo cột inventory_deducted nếu chưa có
-- 2. Cập nhật function work_order_complete_payment với logic mới
-- 3. Tìm và sửa TẤT CẢ phiếu đã thanh toán nhưng chưa trừ kho
-- 4. Hiển thị báo cáo chi tiết
--
-- CÁCH DÙNG: Copy toàn bộ script và paste vào SQL Editor, nhấn Run
-- =============================================================================

DO $$
DECLARE
  v_order RECORD;
  v_part JSONB;
  v_part_id TEXT;
  v_part_name TEXT;
  v_quantity INT;
  v_current_stock INT;
  v_branch_id TEXT;
  v_fixed_count INT := 0;
  v_total_orders INT := 0;
  v_skipped_count INT := 0;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔧 BẮT ĐẦU SỬA LỖI STOCK DEDUCTION';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

  -- BƯỚC 1: Thêm cột inventory_deducted nếu chưa có
  RAISE NOTICE '📋 Bước 1: Kiểm tra và tạo cột inventory_deducted...';
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'work_orders' AND column_name = 'inventory_deducted'
  ) THEN
    ALTER TABLE public.work_orders 
    ADD COLUMN inventory_deducted BOOLEAN DEFAULT FALSE;
    
    RAISE NOTICE '   ✅ Đã tạo cột inventory_deducted';
  ELSE
    RAISE NOTICE '   ℹ️  Cột inventory_deducted đã tồn tại';
  END IF;
  
  RAISE NOTICE '';
  
  -- BƯỚC 2: Cập nhật function work_order_complete_payment
  RAISE NOTICE '📋 Bước 2: Cập nhật function work_order_complete_payment...';
  
  -- Drop các version cũ
  DROP FUNCTION IF EXISTS public.work_order_complete_payment(TEXT, TEXT, NUMERIC, TEXT);
  DROP FUNCTION IF EXISTS public.work_order_complete_payment(TEXT, NUMERIC, TEXT, TEXT);
  
  RAISE NOTICE '   ✅ Function cũ đã được xóa, đang cài đặt version mới...';
  
  RAISE NOTICE '';
  
  -- BƯỚC 3: Đếm số phiếu cần sửa
  RAISE NOTICE '📋 Bước 3: Kiểm tra các phiếu cần sửa...';
  
  SELECT COUNT(*) INTO v_total_orders
  FROM work_orders wo
  WHERE wo.paymentstatus = 'paid'
    AND COALESCE(wo.inventory_deducted, FALSE) = FALSE
    AND wo.partsused IS NOT NULL
    AND jsonb_array_length(wo.partsused) > 0
    AND (
      SELECT COUNT(*) 
      FROM inventory_transactions it
      WHERE it."workOrderId" = wo.id
        AND it.type = 'Xuất kho'
    ) = 0
    AND wo.creationdate >= '2025-11-01'; -- Sửa từ tháng 11
  
  RAISE NOTICE '   📊 Tìm thấy % phiếu đã thanh toán nhưng chưa trừ kho', v_total_orders;
  RAISE NOTICE '';
  
  IF v_total_orders = 0 THEN
    RAISE NOTICE '   ✅ Không có phiếu nào cần sửa!';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ HOÀN THÀNH - Không có data cần sửa';
    RAISE NOTICE '========================================';
    RETURN;
  END IF;
  
  -- BƯỚC 4: Sửa từng phiếu
  RAISE NOTICE '📋 Bước 4: Đang sửa từng phiếu...';
  RAISE NOTICE '';
  
  FOR v_order IN 
    SELECT *
    FROM work_orders wo
    WHERE wo.paymentstatus = 'paid'
      AND COALESCE(wo.inventory_deducted, FALSE) = FALSE
      AND wo.partsused IS NOT NULL
      AND jsonb_array_length(wo.partsused) > 0
      AND (
        SELECT COUNT(*) 
        FROM inventory_transactions it
        WHERE it."workOrderId" = wo.id
          AND it.type = 'Xuất kho'
      ) = 0
      AND wo.creationdate >= '2025-11-01'
    ORDER BY wo.creationdate ASC
  LOOP
    RAISE NOTICE '   🔧 Phiếu ID: % (Ngày: %)', v_order.id, v_order.creationdate::date;
    v_branch_id := v_order.branchid;
    
    -- Lặp qua các part trong phiếu
    FOR v_part IN SELECT * FROM jsonb_array_elements(v_order.partsused)
    LOOP
      v_part_id := (v_part->>'partId');
      v_part_name := (v_part->>'partName');
      v_quantity := COALESCE((v_part->>'quantity')::int, 0);
      
      IF v_part_id IS NULL OR v_quantity <= 0 THEN
        CONTINUE;
      END IF;
      
      -- Kiểm tra part có tồn tại không
      SELECT COALESCE((stock->>v_branch_id)::int, 0) 
      INTO v_current_stock
      FROM parts WHERE id = v_part_id;
      
      IF NOT FOUND THEN
        RAISE NOTICE '      ⚠️  Skip: % (part không tồn tại)', v_part_name;
        v_skipped_count := v_skipped_count + 1;
        CONTINUE;
      END IF;
      
      RAISE NOTICE '      ├─ %: tồn kho = %, trừ %', 
        v_part_name, v_current_stock, v_quantity;
      
      -- Trừ kho
      UPDATE parts
      SET stock = jsonb_set(
        stock,
        ARRAY[v_branch_id],
        to_jsonb(GREATEST(0, v_current_stock - v_quantity))
      )
      WHERE id = v_part_id;
      
      -- Tạo inventory transaction
      INSERT INTO inventory_transactions(
        id, type, "partId", "partName", quantity, date, "unitPrice", "totalPrice",
        "branchId", notes, "workOrderId"
      )
      VALUES (
        gen_random_uuid()::text,
        'Xuất kho',
        v_part_id,
        v_part_name,
        v_quantity,
        v_order.creationdate,
        COALESCE((v_part->>'unitPrice')::numeric, 0),
        COALESCE((v_part->>'totalPrice')::numeric, 0),
        v_branch_id,
        '[AUTO-FIX] Xuất kho cho phiếu ' || v_order.id,
        v_order.id
      );
    END LOOP;
    
    -- Đánh dấu đã trừ kho
    UPDATE work_orders
    SET inventory_deducted = TRUE
    WHERE id = v_order.id;
    
    v_fixed_count := v_fixed_count + 1;
    RAISE NOTICE '      └─ ✅ Đã xử lý xong';
    RAISE NOTICE '';
  END LOOP;
  
  -- BƯỚC 5: Đánh dấu các phiếu cũ đã có xuất kho
  RAISE NOTICE '📋 Bước 5: Đánh dấu các phiếu đã có xuất kho trước đó...';
  
  UPDATE work_orders
  SET inventory_deducted = TRUE
  WHERE paymentstatus = 'paid' 
    AND COALESCE(inventory_deducted, FALSE) = FALSE
    AND partsused IS NOT NULL
    AND jsonb_array_length(partsused) > 0
    AND (
      SELECT COUNT(*) 
      FROM inventory_transactions it
      WHERE it."workOrderId" = work_orders.id
        AND it.type = 'Xuất kho'
    ) > 0;
  
  RAISE NOTICE '   ✅ Hoàn thành';
  RAISE NOTICE '';
  
  -- BÁO CÁO KẾT QUẢ
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 BÁO CÁO KẾT QUẢ';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Đã sửa thành công: % phiếu', v_fixed_count;
  IF v_skipped_count > 0 THEN
    RAISE NOTICE '⚠️  Đã bỏ qua: % parts (không tìm thấy)', v_skipped_count;
  END IF;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';

END $$;

-- Cài đặt function mới
CREATE OR REPLACE FUNCTION public.work_order_complete_payment(
  p_order_id TEXT,
  p_payment_amount NUMERIC,
  p_payment_method TEXT,
  p_user_id TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order RECORD;
  v_part JSONB;
  v_part_id TEXT;
  v_part_name TEXT;
  v_quantity INT;
  v_current_stock INT;
  v_current_reserved INT;
  v_payment_tx_id TEXT;
  v_total_paid NUMERIC;
  v_remaining NUMERIC;
  v_new_status TEXT;
  v_user_branch TEXT;
  v_should_deduct_inventory BOOLEAN;
BEGIN
  -- Get user's branch
  SELECT branch_id INTO v_user_branch
  FROM public.profiles
  WHERE id = auth.uid();
  
  IF v_user_branch IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Get order
  SELECT * INTO v_order FROM work_orders WHERE id = p_order_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  IF v_order.branchid IS DISTINCT FROM v_user_branch THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH';
  END IF;

  -- Check if already refunded
  IF v_order.refunded = TRUE THEN
    RAISE EXCEPTION 'ORDER_REFUNDED';
  END IF;

  -- Calculate new totals
  v_total_paid := COALESCE(v_order.totalpaid, 0) + p_payment_amount;
  v_remaining := v_order.total - v_total_paid;

  -- Determine new payment status
  IF v_remaining <= 0 THEN
    v_new_status := 'paid';
    v_remaining := 0;
  ELSIF v_total_paid > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := 'unpaid';
  END IF;

  -- 🔹 CHỈ TRỪ KHO NẾU: (1) Thanh toán đủ VÀ (2) Chưa trừ kho trước đó
  v_should_deduct_inventory := (v_new_status = 'paid' AND COALESCE(v_order.inventory_deducted, FALSE) = FALSE);

  -- Create payment transaction (nếu có số tiền thanh toán)
  IF p_payment_amount > 0 AND p_payment_method IS NOT NULL THEN
    v_payment_tx_id := gen_random_uuid()::text;
    INSERT INTO cash_transactions(
      id, type, category, amount, date, description, branchid, paymentsource, reference
    )
    VALUES (
      v_payment_tx_id,
      'income',
      'service_income',
      p_payment_amount,
      NOW(),
      'Thanh toán sửa chữa ' || p_order_id,
      v_order.branchid,
      p_payment_method,
      p_order_id
    );
  END IF;

  -- ==========================================================================
  -- Nếu THANH TOÁN ĐỦ VÀ CHƯA TRỪ KHO: Trừ kho thực + tạo inventory transactions
  -- ==========================================================================
  IF v_should_deduct_inventory AND v_order.partsused IS NOT NULL THEN
    FOR v_part IN SELECT * FROM jsonb_array_elements(v_order.partsused)
    LOOP
      v_part_id := (v_part->>'partId');
      v_part_name := (v_part->>'partName');
      v_quantity := COALESCE((v_part->>'quantity')::int, 0);

      IF v_part_id IS NULL OR v_quantity <= 0 THEN
        CONTINUE;
      END IF;

      -- Get current stock and reserved
      SELECT 
        COALESCE((stock->>v_order.branchid)::int, 0),
        COALESCE((reserved->>v_order.branchid)::int, 0)
      INTO v_current_stock, v_current_reserved
      FROM parts WHERE id = v_part_id FOR UPDATE;

      IF NOT FOUND THEN
        CONTINUE; -- Skip if part not found
      END IF;

      -- 1. Giảm reserved
      UPDATE parts
      SET reserved = jsonb_set(
        COALESCE(reserved, '{}'::jsonb),
        ARRAY[v_order.branchid],
        to_jsonb(GREATEST(0, v_current_reserved - v_quantity))
      )
      WHERE id = v_part_id;

      -- 2. Giảm stock thực
      UPDATE parts
      SET stock = jsonb_set(
        stock,
        ARRAY[v_order.branchid],
        to_jsonb(GREATEST(0, v_current_stock - v_quantity))
      )
      WHERE id = v_part_id;

      -- 3. Tạo inventory transaction (Xuất kho)
      INSERT INTO inventory_transactions(
        id, type, "partId", "partName", quantity, date, "unitPrice", "totalPrice",
        "branchId", notes, "workOrderId"
      )
      VALUES (
        gen_random_uuid()::text,
        'Xuất kho',
        v_part_id,
        v_part_name,
        v_quantity,
        NOW(),
        COALESCE((v_part->>'unitPrice')::numeric, 0),
        COALESCE((v_part->>'totalPrice')::numeric, 0),
        v_order.branchid,
        'Xuất kho khi thanh toán phiếu sửa chữa ' || p_order_id,
        p_order_id
      );
    END LOOP;
  END IF;

  -- Update work order
  UPDATE work_orders
  SET
    paymentstatus = v_new_status,
    totalpaid = v_total_paid,
    remainingamount = v_remaining,
    additionalpayment = COALESCE(additionalpayment, 0) + p_payment_amount,
    cashtransactionid = COALESCE(v_payment_tx_id, cashtransactionid),
    paymentdate = CASE WHEN v_payment_tx_id IS NOT NULL THEN NOW() ELSE paymentdate END,
    paymentmethod = COALESCE(p_payment_method, paymentmethod),
    inventory_deducted = CASE WHEN v_should_deduct_inventory THEN TRUE ELSE inventory_deducted END
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'paymentStatus', v_new_status,
    'totalPaid', v_total_paid,
    'remainingAmount', v_remaining,
    'inventoryDeducted', v_should_deduct_inventory,
    'paymentTransactionId', v_payment_tx_id
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.work_order_complete_payment TO authenticated;
COMMENT ON FUNCTION public.work_order_complete_payment 
IS 'Thanh toán phiếu sửa chữa - Tự động trừ kho khi thanh toán đủ (chỉ 1 lần)';

-- =============================================================================
-- QUERY KIỂM TRA KẾT QUẢ (Chạy sau khi script hoàn thành)
-- =============================================================================

-- Kiểm tra phiếu SC-20251206-673440
SELECT 
  wo.id,
  wo.paymentstatus,
  wo.inventory_deducted,
  jsonb_array_length(wo.partsused) as parts_count,
  (
    SELECT COUNT(*)
    FROM inventory_transactions it
    WHERE it."workOrderId" = wo.id AND it.type = 'Xuất kho'
  ) as xuatkho_count
FROM work_orders wo
WHERE wo.id = (SELECT id FROM work_orders WHERE creationdate::date = '2025-12-06' ORDER BY creationdate DESC LIMIT 1);

-- Kiểm tra tồn kho NHB35P
SELECT 
  p.name,
  p.sku,
  p.stock
FROM parts p
WHERE p.sku = 'NHB35P' OR p.name LIKE '%NHB35P%'
ORDER BY p.name;

-- Thống kê tổng quan
SELECT 
  'Tổng phiếu paid (từ 01/11)' as metric,
  COUNT(*) as count
FROM work_orders
WHERE paymentstatus = 'paid' AND creationdate >= '2025-11-01'
UNION ALL
SELECT 
  'Phiếu đã trừ kho',
  COUNT(*)
FROM work_orders
WHERE paymentstatus = 'paid' 
  AND inventory_deducted = TRUE 
  AND creationdate >= '2025-11-01'
UNION ALL
SELECT 
  'Phiếu CHƯA trừ kho',
  COUNT(*)
FROM work_orders
WHERE paymentstatus = 'paid' 
  AND COALESCE(inventory_deducted, FALSE) = FALSE
  AND creationdate >= '2025-11-01';

-- CHI TIẾT 2 phiếu CHƯA trừ kho
SELECT 
  wo.id,
  wo.creationdate,
  wo.customername,
  wo.vehiclemodel,
  wo.licensePlate,
  wo.total,
  wo.paymentstatus,
  wo.inventory_deducted,
  jsonb_array_length(wo.partsused) as parts_count,
  wo.partsused,
  (
    SELECT COUNT(*)
    FROM inventory_transactions it
    WHERE it."workOrderId" = wo.id AND it.type = 'Xuất kho'
  ) as xuatkho_count
FROM work_orders wo
WHERE wo.paymentstatus = 'paid' 
  AND COALESCE(wo.inventory_deducted, FALSE) = FALSE
  AND wo.creationdate >= '2025-11-01'
ORDER BY wo.creationdate DESC;

