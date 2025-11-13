-- Atomic work order update RPC: updates work order and adjusts inventory/cash for parts changes
-- Handles: adding new parts, removing parts, quantity changes

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
  p_parts_used JSONB, -- New parts list
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
BEGIN
  -- Authorization check
  IF NOT public.mc_is_manager_or_owner() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Get existing order and validate
  SELECT partsUsed, branchId, depositAmount, additionalPayment
  INTO v_old_parts, v_branch_id, v_old_deposit, v_old_additional
  FROM work_orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  -- Branch scope guard
  IF v_branch_id IS DISTINCT FROM public.mc_current_branch() THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH';
  END IF;

  -- Validate status
  IF p_status NOT IN ('Tiếp nhận', 'Đang sửa', 'Đã sửa xong', 'Trả máy') THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  -- Validate payment status
  IF p_payment_status NOT IN ('unpaid', 'paid', 'partial') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS';
  END IF;

  -- 🔹 STEP 1: Calculate parts differences and validate stock
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

  -- 🔹 STEP 2: Validate and decrement stock for new/increased parts
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

  -- 🔹 STEP 3: Handle payment changes
  -- Handle new deposit
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

  -- Handle additional payment
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

  -- 🔹 STEP 4: Update work order
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

COMMENT ON FUNCTION public.work_order_update_atomic IS 'Cập nhật phiếu sửa chữa và tự động điều chỉnh tồn kho + tiền mặt khi thay đổi parts (atomic).';

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.work_order_update_atomic TO authenticated;
