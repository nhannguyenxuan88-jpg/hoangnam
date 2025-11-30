-- Allow staff to create work orders
-- Previously only manager/owner could create work orders
-- Now any authenticated user in the same branch can create

-- Update the work_order_create_atomic function to allow staff
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
  v_order_row JSONB;
  v_deposit_tx_id TEXT;
  v_payment_tx_id TEXT;
  v_inventory_tx_count INT := 0;
  v_insufficient JSONB := '[]'::jsonb;
  v_creation_date TIMESTAMP := NOW();
  v_user_branch TEXT;
BEGIN
  -- Get user's branch from profile (column is branch_id with underscore)
  SELECT branch_id INTO v_user_branch
  FROM public.profiles
  WHERE id = auth.uid();
  
  -- Authorization: User must be authenticated and have a branch
  IF v_user_branch IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED: User has no branch assigned';
  END IF;
  
  -- Branch scope guard: user can only create work orders for their own branch
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

  -- Validate and decrement stock for parts
  IF v_parts_count > 0 THEN
    FOR v_index IN 0..(v_parts_count - 1) LOOP
      v_part := p_parts_used->v_index;
      v_part_id := (v_part->>'partId');
      v_part_name := (v_part->>'partName');
      v_quantity := COALESCE((v_part->>'quantity')::int, 0);
      v_price := COALESCE((v_part->>'price')::numeric, 0);

      IF v_part_id IS NULL OR v_quantity <= 0 THEN
        RAISE EXCEPTION 'INVALID_PART';
      END IF;

      -- Get current stock with row lock
      SELECT COALESCE((stock->>p_branch_id)::int, 0) INTO v_current_stock 
      FROM parts WHERE id = v_part_id FOR UPDATE;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'PART_NOT_FOUND: %', v_part_id;
      END IF;

      IF v_current_stock < v_quantity THEN
        v_insufficient := v_insufficient || jsonb_build_object(
          'partId', v_part_id,
          'partName', v_part_name,
          'requested', v_quantity,
          'available', v_current_stock
        );
        CONTINUE;
      END IF;

      -- Decrement stock
      UPDATE parts 
      SET stock = jsonb_set(stock, ARRAY[p_branch_id], to_jsonb(v_current_stock - v_quantity), true) 
      WHERE id = v_part_id;

      -- Insert inventory_transactions (Xuất kho) - using camelCase column names as in actual DB
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
        v_creation_date,
        public.mc_avg_cost(v_part_id, p_branch_id),
        public.mc_avg_cost(v_part_id, p_branch_id) * v_quantity,
        p_branch_id,
        'Sử dụng cho sửa chữa',
        p_order_id
      );
      v_inventory_tx_count := v_inventory_tx_count + 1;
    END LOOP;

    -- If any insufficient stock, raise with details
    IF jsonb_array_length(v_insufficient) > 0 THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_insufficient::text;
    END IF;
  END IF;

  -- Insert work order (use same column names as original function)
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
      id, category, amount, date, description, branchId, paymentSource, reference
    )
    VALUES (
      v_deposit_tx_id,
      'service_deposit',
      p_deposit_amount,
      v_creation_date,
      'Đặt cọc sửa chữa ' || p_order_id,
      p_branch_id,
      p_payment_method,
      p_order_id
    );

    -- Update work order with deposit transaction ID
    UPDATE work_orders 
    SET depositTransactionId = v_deposit_tx_id, depositDate = v_creation_date
    WHERE id = p_order_id;
  END IF;

  -- Create payment transaction if applicable
  IF p_additional_payment > 0 AND p_payment_method IS NOT NULL THEN
    v_payment_tx_id := gen_random_uuid()::text;
    INSERT INTO cash_transactions(
      id, category, amount, date, description, branchId, paymentSource, reference
    )
    VALUES (
      v_payment_tx_id,
      'service_income',
      p_additional_payment,
      v_creation_date,
      'Thu tiền sửa chữa ' || p_order_id,
      p_branch_id,
      p_payment_method,
      p_order_id
    );

    -- Update work order with payment transaction ID
    UPDATE work_orders 
    SET cashTransactionId = v_payment_tx_id, paymentDate = v_creation_date
    WHERE id = p_order_id;
  END IF;

  -- Prepare return JSON
  SELECT jsonb_build_object(
    'workOrder', to_jsonb(w.*),
    'depositTransactionId', v_deposit_tx_id,
    'paymentTransactionId', v_payment_tx_id,
    'inventoryTxCount', v_inventory_tx_count
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
    NULL; -- swallow audit errors
  END;

  RETURN v_order_row;
  
  EXCEPTION
  WHEN OTHERS THEN
    RAISE; -- Rollback on any error
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.work_order_create_atomic TO authenticated;

COMMENT ON FUNCTION public.work_order_create_atomic IS 'Creates work order - allows any authenticated user in same branch (staff, manager, owner)';

-- =====================================================
-- ALSO UPDATE work_order_update_atomic to allow staff
-- Copy from original 2025-11-13_work_order_update_atomic.sql but change authorization
-- =====================================================

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
  v_price NUMERIC;
  v_current_stock INT;
  v_order_row JSONB;
  v_branch_id TEXT;
  v_deposit_tx_id TEXT;
  v_payment_tx_id TEXT;
  v_old_deposit NUMERIC;
  v_old_additional NUMERIC;
  v_insufficient JSONB := '[]'::jsonb;
  v_index INT := 0;
  v_parts_count INT := COALESCE(jsonb_array_length(p_parts_used), 0);
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

  -- Get existing order and validate
  SELECT partsUsed, branchId, depositAmount, additionalPayment
  INTO v_old_parts, v_branch_id, v_old_deposit, v_old_additional
  FROM work_orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  -- Branch scope guard: user can only update work orders in their own branch
  IF v_branch_id IS DISTINCT FROM v_user_branch THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH: Cannot update work order from different branch';
  END IF;

  -- Validate status
  IF p_status NOT IN ('Tiếp nhận', 'Đang sửa', 'Đã sửa xong', 'Trả máy') THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  -- Validate payment status
  IF p_payment_status NOT IN ('unpaid', 'paid', 'partial') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS';
  END IF;

  -- STEP 1: Calculate parts differences and validate stock
  -- First, restore stock for removed/reduced parts
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
      -- Part removed completely -> restore full quantity
      v_quantity_diff := v_old_quantity;
    ELSE
      -- Part still exists -> calculate difference
      v_quantity := COALESCE((v_new_part->>'quantity')::int, 0);
      v_quantity_diff := v_old_quantity - v_quantity;
    END IF;

    -- Restore stock if quantity decreased or part removed
    IF v_quantity_diff > 0 THEN
      SELECT COALESCE((stock->>v_branch_id)::int, 0) INTO v_current_stock
      FROM parts WHERE id = v_part_id FOR UPDATE;

      UPDATE parts
      SET stock = jsonb_set(stock, ARRAY[v_branch_id], to_jsonb(v_current_stock + v_quantity_diff), true)
      WHERE id = v_part_id;

      -- Create inventory transaction (Nhập kho - restore)
      INSERT INTO inventory_transactions(
        id, type, partId, partName, quantity, date, unitPrice, totalPrice,
        branchId, notes, workOrderId
      )
      VALUES (
        gen_random_uuid()::text,
        'Nhập kho',
        v_part_id,
        (v_old_part->>'partName'),
        v_quantity_diff,
        NOW(),
        public.mc_avg_cost(v_part_id, v_branch_id),
        public.mc_avg_cost(v_part_id, v_branch_id) * v_quantity_diff,
        v_branch_id,
        'Trả lại từ cập nhật phiếu sửa',
        p_order_id
      );
    END IF;
  END LOOP;

  -- STEP 2: Validate and decrement stock for new/increased parts
  FOR v_index IN 0..(v_parts_count - 1) LOOP
    v_new_part := p_parts_used->v_index;
    v_part_id := (v_new_part->>'partId');
    v_part_name := (v_new_part->>'partName');
    v_quantity := COALESCE((v_new_part->>'quantity')::int, 0);
    v_price := COALESCE((v_new_part->>'price')::numeric, 0);

    IF v_part_id IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'INVALID_PART';
    END IF;

    -- Find old quantity for this part
    v_old_quantity := 0;
    FOR v_old_part IN SELECT * FROM jsonb_array_elements(COALESCE(v_old_parts, '[]'::jsonb))
    LOOP
      IF (v_old_part->>'partId') = v_part_id THEN
        v_old_quantity := COALESCE((v_old_part->>'quantity')::int, 0);
        EXIT;
      END IF;
    END LOOP;

    -- Calculate additional quantity needed
    v_quantity_diff := v_quantity - v_old_quantity;

    -- If need more parts, check stock and decrement
    IF v_quantity_diff > 0 THEN
      SELECT COALESCE((stock->>v_branch_id)::int, 0) INTO v_current_stock
      FROM parts WHERE id = v_part_id FOR UPDATE;

      IF NOT FOUND THEN
        RAISE EXCEPTION 'PART_NOT_FOUND: %', v_part_id;
      END IF;

      IF v_current_stock < v_quantity_diff THEN
        v_insufficient := v_insufficient || jsonb_build_object(
          'partId', v_part_id,
          'partName', v_part_name,
          'requested', v_quantity_diff,
          'available', v_current_stock
        );
        CONTINUE;
      END IF;

      -- Decrement stock
      UPDATE parts
      SET stock = jsonb_set(stock, ARRAY[v_branch_id], to_jsonb(v_current_stock - v_quantity_diff), true)
      WHERE id = v_part_id;

      -- Create inventory transaction (Xuất kho)
      INSERT INTO inventory_transactions(
        id, type, partId, partName, quantity, date, unitPrice, totalPrice,
        branchId, notes, workOrderId
      )
      VALUES (
        gen_random_uuid()::text,
        'Xuất kho',
        v_part_id,
        v_part_name,
        v_quantity_diff,
        NOW(),
        public.mc_avg_cost(v_part_id, v_branch_id),
        public.mc_avg_cost(v_part_id, v_branch_id) * v_quantity_diff,
        v_branch_id,
        'Thêm vào phiếu sửa',
        p_order_id
      );
    END IF;
  END LOOP;

  -- If any insufficient stock, raise with details
  IF jsonb_array_length(v_insufficient) > 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_insufficient::text;
  END IF;

  -- STEP 3: Handle payment changes
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

  -- STEP 4: Update work order
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
    depositAmount = CASE WHEN p_deposit_amount > 0 THEN p_deposit_amount ELSE NULL END,
    additionalPayment = CASE WHEN p_additional_payment > 0 THEN p_additional_payment ELSE NULL END,
    totalPaid = COALESCE(p_deposit_amount, 0) + COALESCE(p_additional_payment, 0),
    remainingAmount = p_total - (COALESCE(p_deposit_amount, 0) + COALESCE(p_additional_payment, 0)),
    depositTransactionId = COALESCE(v_deposit_tx_id, depositTransactionId),
    cashTransactionId = COALESCE(v_payment_tx_id, cashTransactionId),
    depositDate = CASE WHEN v_deposit_tx_id IS NOT NULL THEN NOW() ELSE depositDate END,
    paymentDate = CASE WHEN v_payment_tx_id IS NOT NULL THEN NOW() ELSE paymentDate END
  WHERE id = p_order_id;

  -- Prepare return JSON
  SELECT jsonb_build_object(
    'workOrder', to_jsonb(w.*),
    'depositTransactionId', v_deposit_tx_id,
    'paymentTransactionId', v_payment_tx_id
  ) INTO v_order_row
  FROM work_orders w WHERE w.id = p_order_id;

  -- Audit log (best-effort)
  BEGIN
    INSERT INTO audit_logs(
      id, user_id, action, table_name, record_id, old_data, new_data, created_at
    )
    VALUES (
      gen_random_uuid()::text,
      COALESCE(p_user_id, NULL),
      'work_order.update',
      'work_orders',
      p_order_id,
      jsonb_build_object('partsUsed', v_old_parts),
      v_order_row->'workOrder',
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- swallow audit errors
  END;

  RETURN v_order_row;

  EXCEPTION
  WHEN OTHERS THEN
    RAISE; -- Rollback on any error
END;
$$;

GRANT EXECUTE ON FUNCTION public.work_order_update_atomic TO authenticated;

COMMENT ON FUNCTION public.work_order_update_atomic IS 'Updates work order - allows any authenticated user in same branch (staff, manager, owner)';
