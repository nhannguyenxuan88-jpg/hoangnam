-- =============================================================================
-- RESERVE STOCK LOGIC: Chỉ đặt trước khi tạo phiếu, trừ kho khi thanh toán
-- =============================================================================
-- Logic mới:
-- 1. Khi TẠO phiếu sửa chữa: RESERVE (đặt trước) phụ tùng, KHÔNG trừ kho
-- 2. Khi THANH TOÁN hoàn tất: Trừ kho thực + tạo inventory_transactions
-- 3. Khi HỦY phiếu: Giải phóng reserved stock
-- =============================================================================

-- First, ensure reserved column exists in parts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'parts' AND column_name = 'reserved'
  ) THEN
    ALTER TABLE public.parts ADD COLUMN reserved JSONB DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN public.parts.reserved IS 'Reserved stock per branch - not yet deducted, waiting for payment';
  END IF;
END $$;

-- =============================================================================
-- 1. CREATE FUNCTION: Tạo phiếu - chỉ reserve, không trừ kho
-- =============================================================================
CREATE OR REPLACE FUNCTION public.work_order_create_atomic(
  p_order_id TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_vehicle_model TEXT,
  p_license_plate TEXT,
  p_issue_description TEXT,
  p_technician_name TEXT,
  p_status TEXT,
  p_labor_cost NUMERIC,
  p_discount NUMERIC,
  p_parts_used JSONB,
  p_additional_services JSONB,
  p_total NUMERIC,
  p_branch_id TEXT,
  p_payment_status TEXT,
  p_payment_method TEXT,
  p_deposit_amount NUMERIC,
  p_additional_payment NUMERIC,
  p_user_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_part JSONB;
  v_index INT := 0;
  v_parts_count INT := COALESCE(jsonb_array_length(p_parts_used), 0);
  v_part_id TEXT;
  v_part_name TEXT;
  v_quantity INT;
  v_price NUMERIC;
  v_current_stock INT;
  v_current_reserved INT;
  v_available INT;
  v_order_row JSONB;
  v_deposit_tx_id TEXT;
  v_payment_tx_id TEXT;
  v_warnings JSONB := '[]'::jsonb;
  v_creation_date TIMESTAMP := NOW();
  v_user_branch TEXT;
BEGIN
  -- Get user's branch from profile
  SELECT branch_id INTO v_user_branch
  FROM public.profiles
  WHERE id = auth.uid();
  
  -- Authorization: User must be authenticated and have a branch
  IF v_user_branch IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User has no branch assigned';
  END IF;
  
  -- Branch scope guard
  IF p_branch_id IS DISTINCT FROM v_user_branch THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Cannot create work order for different branch';
  END IF;

  -- Validate status
  IF p_status NOT IN ('Tiếp nhận', 'Đang sửa', 'Đã sửa xong', 'Trả máy') THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  -- Validate payment status
  IF p_payment_status NOT IN ('unpaid', 'paid', 'partial') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS';
  END IF;

  -- ==========================================================================
  -- RESERVE parts (không trừ kho thực)
  -- ==========================================================================
  IF v_parts_count > 0 THEN
    FOR v_index IN 0..(v_parts_count - 1) LOOP
      v_part := p_parts_used->v_index;
      v_part_id := (v_part->>'partId');
      v_part_name := (v_part->>'partName');
      v_quantity := COALESCE((v_part->>'quantity')::int, 0);

      IF v_part_id IS NULL OR v_quantity <= 0 THEN
        CONTINUE; -- Skip invalid parts
      END IF;

      -- Get current stock and reserved with row lock
      SELECT 
        COALESCE((stock->>p_branch_id)::int, 0),
        COALESCE((reserved->>p_branch_id)::int, 0)
      INTO v_current_stock, v_current_reserved
      FROM parts WHERE id = v_part_id FOR UPDATE;
      
      IF NOT FOUND THEN
        CONTINUE; -- Skip if part not found
      END IF;

      -- Calculate available = stock - already reserved
      v_available := v_current_stock - v_current_reserved;

      -- Check if enough available stock
      IF v_available < v_quantity THEN
        -- Add warning but still allow creation (cho phép đặt trước dù thiếu)
        v_warnings := v_warnings || jsonb_build_object(
          'partId', v_part_id,
          'partName', v_part_name,
          'requested', v_quantity,
          'available', v_available,
          'message', 'Tồn kho không đủ: ' || v_part_name || ' (cần ' || v_quantity || ', còn ' || v_available || ')'
        );
      END IF;

      -- RESERVE stock (increase reserved amount) - KHÔNG trừ kho thực
      UPDATE parts
      SET reserved = jsonb_set(
        COALESCE(reserved, '{}'::jsonb),
        ARRAY[p_branch_id],
        to_jsonb(v_current_reserved + v_quantity)
      )
      WHERE id = v_part_id;
    END LOOP;
  END IF;

  -- Insert work order
  INSERT INTO work_orders(
    id, customerName, customerPhone, vehicleModel, licensePlate,
    issueDescription, technicianName, status, laborCost, discount,
    partsUsed, additionalServices, total, branchId, paymentStatus,
    paymentMethod, depositAmount, additionalPayment, totalPaid,
    remainingAmount, creationDate
  )
  VALUES (
    p_order_id, p_customer_name, p_customer_phone, p_vehicle_model, p_license_plate,
    p_issue_description, p_technician_name, p_status, p_labor_cost, p_discount,
    p_parts_used, p_additional_services, p_total, p_branch_id, p_payment_status,
    p_payment_method, 
    CASE WHEN p_deposit_amount > 0 THEN p_deposit_amount ELSE NULL END,
    CASE WHEN p_additional_payment > 0 THEN p_additional_payment ELSE NULL END,
    COALESCE(p_deposit_amount, 0) + COALESCE(p_additional_payment, 0),
    p_total - (COALESCE(p_deposit_amount, 0) + COALESCE(p_additional_payment, 0)),
    v_creation_date
  );

  -- Create deposit transaction if applicable
  IF p_deposit_amount > 0 AND p_payment_method IS NOT NULL THEN
    v_deposit_tx_id := gen_random_uuid()::text;
    INSERT INTO cash_transactions(
      id, type, category, amount, date, description, branchId, paymentSource, reference
    )
    VALUES (
      v_deposit_tx_id,
      'income',
      'service_deposit',
      p_deposit_amount,
      v_creation_date,
      'Đặt cọc sửa chữa ' || p_order_id,
      p_branch_id,
      p_payment_method,
      p_order_id
    );

    UPDATE work_orders 
    SET depositTransactionId = v_deposit_tx_id, depositDate = v_creation_date
    WHERE id = p_order_id;
  END IF;

  -- Create payment transaction if applicable
  IF p_additional_payment > 0 AND p_payment_method IS NOT NULL THEN
    v_payment_tx_id := gen_random_uuid()::text;
    INSERT INTO cash_transactions(
      id, type, category, amount, date, description, branchId, paymentSource, reference
    )
    VALUES (
      v_payment_tx_id,
      'income',
      'service_income',
      p_additional_payment,
      v_creation_date,
      'Thu tiền sửa chữa ' || p_order_id,
      p_branch_id,
      p_payment_method,
      p_order_id
    );

    UPDATE work_orders 
    SET cashTransactionId = v_payment_tx_id, paymentDate = v_creation_date
    WHERE id = p_order_id;
  END IF;

  -- Prepare return JSON with warnings
  SELECT jsonb_build_object(
    'workOrder', to_jsonb(w.*),
    'depositTransactionId', v_deposit_tx_id,
    'paymentTransactionId', v_payment_tx_id,
    'stockWarnings', v_warnings
  ) INTO v_order_row
  FROM work_orders w WHERE w.id = p_order_id;

  -- Insert audit log (best-effort)
  BEGIN
    INSERT INTO audit_logs(
      id, user_id, action, table_name, record_id, old_data, new_data, created_at
    )
    VALUES (
      gen_random_uuid()::text,
      COALESCE(p_user_id, NULL),
      'work_order.create',
      'work_orders',
      p_order_id,
      NULL,
      v_order_row->'workOrder',
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_order_row;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.work_order_create_atomic TO authenticated;
COMMENT ON FUNCTION public.work_order_create_atomic IS 'Tạo phiếu sửa chữa - CHỈ đặt trước tồn kho (reserve), KHÔNG trừ kho thực';

-- =============================================================================
-- 2. UPDATE FUNCTION: Cập nhật phiếu - điều chỉnh reserved
-- =============================================================================
CREATE OR REPLACE FUNCTION public.work_order_update_atomic(
  p_order_id TEXT,
  p_customer_name TEXT,
  p_customer_phone TEXT,
  p_vehicle_model TEXT,
  p_license_plate TEXT,
  p_issue_description TEXT,
  p_technician_name TEXT,
  p_status TEXT,
  p_labor_cost NUMERIC,
  p_discount NUMERIC,
  p_parts_used JSONB,
  p_additional_services JSONB,
  p_total NUMERIC,
  p_payment_status TEXT,
  p_payment_method TEXT,
  p_deposit_amount NUMERIC,
  p_additional_payment NUMERIC,
  p_user_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_parts JSONB;
  v_new_part JSONB;
  v_old_part JSONB;
  v_part_id TEXT;
  v_part_name TEXT;
  v_quantity INT;
  v_old_quantity INT;
  v_quantity_diff INT;
  v_current_stock INT;
  v_current_reserved INT;
  v_available INT;
  v_order_row JSONB;
  v_branch_id TEXT;
  v_deposit_tx_id TEXT;
  v_payment_tx_id TEXT;
  v_old_deposit NUMERIC;
  v_old_additional NUMERIC;
  v_warnings JSONB := '[]'::jsonb;
  v_index INT := 0;
  v_parts_count INT := COALESCE(jsonb_array_length(p_parts_used), 0);
  v_user_branch TEXT;
BEGIN
  -- Get user's branch from profile
  SELECT branch_id INTO v_user_branch
  FROM public.profiles
  WHERE id = auth.uid();
  
  IF v_user_branch IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User has no branch assigned';
  END IF;

  -- Get existing order
  SELECT partsUsed, branchId, depositAmount, additionalPayment
  INTO v_old_parts, v_branch_id, v_old_deposit, v_old_additional
  FROM work_orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  IF v_branch_id IS DISTINCT FROM v_user_branch THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH';
  END IF;

  IF p_status NOT IN ('Tiếp nhận', 'Đang sửa', 'Đã sửa xong', 'Trả máy') THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  IF p_payment_status NOT IN ('unpaid', 'paid', 'partial') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS';
  END IF;

  -- ==========================================================================
  -- STEP 1: Release reserved for removed/reduced parts
  -- ==========================================================================
  FOR v_old_part IN SELECT * FROM jsonb_array_elements(COALESCE(v_old_parts, '[]'::jsonb))
  LOOP
    v_part_id := (v_old_part->>'partId');
    v_old_quantity := COALESCE((v_old_part->>'quantity')::int, 0);
    
    -- Find if this part still exists in new parts list
    v_new_part := NULL;
    FOR v_index IN 0..(v_parts_count - 1) LOOP
      IF (p_parts_used->v_index->>'partId') = v_part_id THEN
        v_new_part := p_parts_used->v_index;
        EXIT;
      END IF;
    END LOOP;

    IF v_new_part IS NULL THEN
      v_quantity_diff := v_old_quantity; -- Part removed completely
    ELSE
      v_quantity := COALESCE((v_new_part->>'quantity')::int, 0);
      v_quantity_diff := v_old_quantity - v_quantity;
    END IF;

    -- Release reserved if quantity decreased
    IF v_quantity_diff > 0 THEN
      SELECT COALESCE((reserved->>v_branch_id)::int, 0) INTO v_current_reserved
      FROM parts WHERE id = v_part_id FOR UPDATE;

      UPDATE parts
      SET reserved = jsonb_set(
        COALESCE(reserved, '{}'::jsonb),
        ARRAY[v_branch_id],
        to_jsonb(GREATEST(0, v_current_reserved - v_quantity_diff))
      )
      WHERE id = v_part_id;
    END IF;
  END LOOP;

  -- ==========================================================================
  -- STEP 2: Reserve more for new/increased parts
  -- ==========================================================================
  FOR v_index IN 0..(v_parts_count - 1) LOOP
    v_new_part := p_parts_used->v_index;
    v_part_id := (v_new_part->>'partId');
    v_part_name := (v_new_part->>'partName');
    v_quantity := COALESCE((v_new_part->>'quantity')::int, 0);

    IF v_part_id IS NULL OR v_quantity <= 0 THEN
      CONTINUE;
    END IF;

    -- Find old quantity
    v_old_quantity := 0;
    FOR v_old_part IN SELECT * FROM jsonb_array_elements(COALESCE(v_old_parts, '[]'::jsonb))
    LOOP
      IF (v_old_part->>'partId') = v_part_id THEN
        v_old_quantity := COALESCE((v_old_part->>'quantity')::int, 0);
        EXIT;
      END IF;
    END LOOP;

    v_quantity_diff := v_quantity - v_old_quantity;

    -- Reserve more if quantity increased
    IF v_quantity_diff > 0 THEN
      SELECT 
        COALESCE((stock->>v_branch_id)::int, 0),
        COALESCE((reserved->>v_branch_id)::int, 0)
      INTO v_current_stock, v_current_reserved
      FROM parts WHERE id = v_part_id FOR UPDATE;

      v_available := v_current_stock - v_current_reserved;

      IF v_available < v_quantity_diff THEN
        v_warnings := v_warnings || jsonb_build_object(
          'partId', v_part_id,
          'partName', v_part_name,
          'requested', v_quantity_diff,
          'available', v_available,
          'message', 'Tồn kho không đủ: ' || v_part_name
        );
      END IF;

      UPDATE parts
      SET reserved = jsonb_set(
        COALESCE(reserved, '{}'::jsonb),
        ARRAY[v_branch_id],
        to_jsonb(v_current_reserved + v_quantity_diff)
      )
      WHERE id = v_part_id;
    END IF;
  END LOOP;

  -- ==========================================================================
  -- STEP 3: Handle payment changes
  -- ==========================================================================
  IF p_deposit_amount > COALESCE(v_old_deposit, 0) AND p_payment_method IS NOT NULL THEN
    v_deposit_tx_id := gen_random_uuid()::text;
    INSERT INTO cash_transactions(
      id, type, category, amount, date, description, branchId, paymentSource, reference
    )
    VALUES (
      v_deposit_tx_id,
      'income',
      'service_deposit',
      p_deposit_amount - COALESCE(v_old_deposit, 0),
      NOW(),
      'Đặt cọc bổ sung ' || p_order_id,
      v_branch_id,
      p_payment_method,
      p_order_id
    );
  END IF;

  IF p_additional_payment > COALESCE(v_old_additional, 0) AND p_payment_method IS NOT NULL THEN
    v_payment_tx_id := gen_random_uuid()::text;
    INSERT INTO cash_transactions(
      id, type, category, amount, date, description, branchId, paymentSource, reference
    )
    VALUES (
      v_payment_tx_id,
      'income',
      'service_income',
      p_additional_payment - COALESCE(v_old_additional, 0),
      NOW(),
      'Thu tiền bổ sung ' || p_order_id,
      v_branch_id,
      p_payment_method,
      p_order_id
    );
  END IF;

  -- ==========================================================================
  -- STEP 4: Update work order
  -- ==========================================================================
  UPDATE work_orders
  SET
    customerName = p_customer_name,
    customerPhone = p_customer_phone,
    vehicleModel = p_vehicle_model,
    licensePlate = p_license_plate,
    issueDescription = p_issue_description,
    technicianName = p_technician_name,
    status = p_status,
    laborCost = p_labor_cost,
    discount = p_discount,
    partsUsed = p_parts_used,
    additionalServices = p_additional_services,
    total = p_total,
    paymentStatus = p_payment_status,
    paymentMethod = p_payment_method,
    depositAmount = CASE WHEN p_deposit_amount > 0 THEN p_deposit_amount ELSE depositAmount END,
    additionalPayment = CASE WHEN p_additional_payment > 0 THEN p_additional_payment ELSE additionalPayment END,
    totalPaid = COALESCE(p_deposit_amount, depositAmount, 0) + COALESCE(p_additional_payment, additionalPayment, 0),
    remainingAmount = p_total - (COALESCE(p_deposit_amount, depositAmount, 0) + COALESCE(p_additional_payment, additionalPayment, 0)),
    depositTransactionId = COALESCE(v_deposit_tx_id, depositTransactionId),
    cashTransactionId = COALESCE(v_payment_tx_id, cashTransactionId),
    depositDate = CASE WHEN v_deposit_tx_id IS NOT NULL THEN NOW() ELSE depositDate END,
    paymentDate = CASE WHEN v_payment_tx_id IS NOT NULL THEN NOW() ELSE paymentDate END
  WHERE id = p_order_id;

  -- Build return JSON
  SELECT jsonb_build_object(
    'workOrder', to_jsonb(w.*),
    'depositTransactionId', v_deposit_tx_id,
    'paymentTransactionId', v_payment_tx_id,
    'stockWarnings', v_warnings
  ) INTO v_order_row
  FROM work_orders w WHERE w.id = p_order_id;

  RETURN v_order_row;

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.work_order_update_atomic TO authenticated;
COMMENT ON FUNCTION public.work_order_update_atomic IS 'Cập nhật phiếu sửa chữa - điều chỉnh reserved stock';

-- =============================================================================
-- 3. COMPLETE PAYMENT FUNCTION: Trừ kho thực khi thanh toán hoàn tất
-- =============================================================================
-- Drop old function with different signature first
DROP FUNCTION IF EXISTS public.work_order_complete_payment(TEXT, TEXT, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS public.work_order_complete_payment(TEXT, NUMERIC, TEXT, TEXT);

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

  IF v_order.branchId IS DISTINCT FROM v_user_branch THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH';
  END IF;

  -- Calculate new totals
  v_total_paid := COALESCE(v_order.totalPaid, 0) + p_payment_amount;
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

  -- Create payment transaction
  v_payment_tx_id := gen_random_uuid()::text;
  INSERT INTO cash_transactions(
    id, type, category, amount, date, description, branchId, paymentSource, reference
  )
  VALUES (
    v_payment_tx_id,
    'income',
    'service_income',
    p_payment_amount,
    NOW(),
    'Thanh toán sửa chữa ' || p_order_id,
    v_order.branchId,
    p_payment_method,
    p_order_id
  );

  -- ==========================================================================
  -- Nếu THANH TOÁN ĐỦ: Trừ kho thực + tạo inventory transactions
  -- ==========================================================================
  IF v_new_status = 'paid' AND v_order.partsUsed IS NOT NULL THEN
    FOR v_part IN SELECT * FROM jsonb_array_elements(v_order.partsUsed)
    LOOP
      v_part_id := (v_part->>'partId');
      v_part_name := (v_part->>'partName');
      v_quantity := COALESCE((v_part->>'quantity')::int, 0);

      IF v_part_id IS NULL OR v_quantity <= 0 THEN
        CONTINUE;
      END IF;

      -- Get current stock and reserved
      SELECT 
        COALESCE((stock->>v_order.branchId)::int, 0),
        COALESCE((reserved->>v_order.branchId)::int, 0)
      INTO v_current_stock, v_current_reserved
      FROM parts WHERE id = v_part_id FOR UPDATE;

      -- 1. Giảm reserved
      UPDATE parts
      SET reserved = jsonb_set(
        COALESCE(reserved, '{}'::jsonb),
        ARRAY[v_order.branchId],
        to_jsonb(GREATEST(0, v_current_reserved - v_quantity))
      )
      WHERE id = v_part_id;

      -- 2. Giảm stock thực
      UPDATE parts
      SET stock = jsonb_set(
        stock,
        ARRAY[v_order.branchId],
        to_jsonb(GREATEST(0, v_current_stock - v_quantity))
      )
      WHERE id = v_part_id;

      -- 3. Tạo inventory transaction (Xuất kho)
      INSERT INTO inventory_transactions(
        id, type, partId, partName, quantity, date, unitPrice, totalPrice,
        branchId, notes, workOrderId
      )
      VALUES (
        gen_random_uuid()::text,
        'Xuất kho',
        v_part_id,
        v_part_name,
        v_quantity,
        NOW(),
        public.mc_avg_cost(v_part_id, v_order.branchId),
        public.mc_avg_cost(v_part_id, v_order.branchId) * v_quantity,
        v_order.branchId,
        'Xuất kho khi thanh toán phiếu sửa chữa',
        p_order_id
      );
    END LOOP;
  END IF;

  -- Update work order
  UPDATE work_orders
  SET
    paymentStatus = v_new_status,
    totalPaid = v_total_paid,
    remainingAmount = v_remaining,
    additionalPayment = COALESCE(additionalPayment, 0) + p_payment_amount,
    cashTransactionId = v_payment_tx_id,
    paymentDate = NOW()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'paymentStatus', v_new_status,
    'totalPaid', v_total_paid,
    'remainingAmount', v_remaining,
    'inventoryDeducted', (v_new_status = 'paid')
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.work_order_complete_payment TO authenticated;
COMMENT ON FUNCTION public.work_order_complete_payment IS 'Thanh toán phiếu sửa chữa - trừ kho thực khi thanh toán đủ';

-- =============================================================================
-- 4. REFUND/CANCEL: Giải phóng reserved và hoàn kho nếu cần
-- =============================================================================
-- (Giữ nguyên function refund hiện tại, chỉ cần đảm bảo release reserved)

SELECT 'Reserve stock logic installed successfully!' AS result;
