-- =============================================================================
-- KIỂM TRA VÀ TRỪ KHO CHO CÁC PHIẾU ĐÃ THANH TOÁN NHƯNG CHƯA TRỪ KHO
-- =============================================================================
-- Mục đích: Sửa các phiếu sửa chữa đã thanh toán đủ nhưng chưa trừ kho
-- Ngày tạo: 2025-12-11
-- =============================================================================

DO $$
DECLARE
  v_order RECORD;
  v_part JSONB;
  v_part_id TEXT;
  v_part_name TEXT;
  v_quantity INT;
  v_current_stock INT;
  v_current_reserved INT;
  v_branch_id TEXT;
  v_fixed_count INT := 0;
  v_skipped_count INT := 0;
  v_total_orders INT;
  v_unit_price NUMERIC;
  v_total_price NUMERIC;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🔍 KIỂM TRA VÀ TRỪ KHO CHO PHIẾU CHƯA XỬ LÝ';
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  
  -- Đếm số phiếu cần sửa
  SELECT COUNT(*) INTO v_total_orders
  FROM work_orders wo
  WHERE wo.paymentstatus = 'paid'
    AND COALESCE(wo.inventory_deducted, FALSE) = FALSE
    AND wo.partsused IS NOT NULL
    AND jsonb_array_length(wo.partsused) > 0;
  
  RAISE NOTICE '📊 Tìm thấy % phiếu đã thanh toán nhưng chưa trừ kho', v_total_orders;
  RAISE NOTICE '';
  
  IF v_total_orders = 0 THEN
    RAISE NOTICE '✅ Không có phiếu nào cần sửa!';
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ HOÀN THÀNH';
    RAISE NOTICE '========================================';
    RETURN;
  END IF;
  
  RAISE NOTICE '🔧 Bắt đầu xử lý từng phiếu...';
  RAISE NOTICE '';
  
  -- Xử lý từng phiếu
  FOR v_order IN 
    SELECT *
    FROM work_orders wo
    WHERE wo.paymentstatus = 'paid'
      AND COALESCE(wo.inventory_deducted, FALSE) = FALSE
      AND wo.partsused IS NOT NULL
      AND jsonb_array_length(wo.partsused) > 0
    ORDER BY wo.creationdate ASC
  LOOP
    RAISE NOTICE '📋 Phiếu: % (Ngày: %)', 
      SUBSTRING(v_order.id, 1, 8) || '...', 
      v_order.creationdate::date;
    
    v_branch_id := v_order.branchid;
    
    -- Kiểm tra xem đã có inventory transaction chưa
    IF EXISTS (
      SELECT 1 FROM inventory_transactions 
      WHERE "workOrderId" = v_order.id 
        AND type = 'Xuất kho'
    ) THEN
      RAISE NOTICE '   ⚠️  Skip: Đã có giao dịch xuất kho rồi';
      v_skipped_count := v_skipped_count + 1;
      RAISE NOTICE '';
      CONTINUE;
    END IF;
    
    -- Xử lý từng phụ tùng
    FOR v_part IN SELECT * FROM jsonb_array_elements(v_order.partsused)
    LOOP
      v_part_id := (v_part->>'partId');
      v_part_name := (v_part->>'partName');
      v_quantity := COALESCE((v_part->>'quantity')::int, 0);
      v_unit_price := COALESCE((v_part->>'unitPrice')::numeric, 0);
      v_total_price := COALESCE((v_part->>'totalPrice')::numeric, 0);
      
      IF v_part_id IS NULL OR v_quantity <= 0 THEN
        CONTINUE;
      END IF;
      
      -- Lấy tồn kho hiện tại
      SELECT 
        COALESCE((stock->>v_branch_id)::int, 0),
        COALESCE((reserved->>v_branch_id)::int, 0)
      INTO v_current_stock, v_current_reserved
      FROM parts WHERE id = v_part_id;
      
      IF NOT FOUND THEN
        RAISE NOTICE '   ⚠️  Skip: % (phụ tùng không tồn tại)', v_part_name;
        CONTINUE;
      END IF;
      
      RAISE NOTICE '   ├─ %: tồn = %, reserved = %, trừ = %', 
        v_part_name, v_current_stock, v_current_reserved, v_quantity;
      
      -- 1. Giảm reserved (nếu có)
      IF v_current_reserved > 0 THEN
        UPDATE parts
        SET reserved = jsonb_set(
          COALESCE(reserved, '{}'::jsonb),
          ARRAY[v_branch_id],
          to_jsonb(GREATEST(0, v_current_reserved - v_quantity))
        )
        WHERE id = v_part_id;
      END IF;
      
      -- 2. Trừ stock thực
      UPDATE parts
      SET stock = jsonb_set(
        stock,
        ARRAY[v_branch_id],
        to_jsonb(GREATEST(0, v_current_stock - v_quantity))
      )
      WHERE id = v_part_id;
      
      -- 3. Tạo inventory transaction
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
        v_unit_price,
        v_total_price,
        v_branch_id,
        '[AUTO-FIX 2025-12-12] Xuất kho cho phiếu đã thanh toán',
        v_order.id
      );
      
      RAISE NOTICE '      └─ ✅ Đã trừ kho và tạo giao dịch';
    END LOOP;
    
    -- Đánh dấu đã trừ kho
    UPDATE work_orders
    SET inventory_deducted = TRUE
    WHERE id = v_order.id;
    
    v_fixed_count := v_fixed_count + 1;
    RAISE NOTICE '   ✅ Hoàn thành phiếu này';
    RAISE NOTICE '';
  END LOOP;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ HOÀN THÀNH XỬ LÝ';
  RAISE NOTICE '========================================';
  RAISE NOTICE '📊 Tổng kết:';
  RAISE NOTICE '   - Tổng phiếu tìm thấy: %', v_total_orders;
  RAISE NOTICE '   - Đã sửa: %', v_fixed_count;
  RAISE NOTICE '   - Bỏ qua: %', v_skipped_count;
  RAISE NOTICE '========================================';
  
END $$;

-- Kiểm tra kết quả
SELECT 
  COUNT(*) as total_paid_orders,
  SUM(CASE WHEN inventory_deducted = TRUE THEN 1 ELSE 0 END) as deducted,
  SUM(CASE WHEN inventory_deducted = FALSE THEN 1 ELSE 0 END) as not_deducted
FROM work_orders
WHERE paymentstatus = 'paid'
  AND partsused IS NOT NULL
  AND jsonb_array_length(partsused) > 0;
