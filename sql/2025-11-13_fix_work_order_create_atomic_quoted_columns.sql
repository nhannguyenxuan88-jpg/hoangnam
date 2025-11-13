-- Fix work_order_create_atomic function to use quoted column names for inventory_transactions
-- This ensures compatibility with camelCase column names in the database

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
BEGIN
  -- Authorization & branch scope guard
  IF NOT public.mc_is_manager_or_owner() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;
  
  IF p_branch_id IS DISTINCT FROM public.mc_current_branch() THEN
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

      -- Insert inventory_transactions (Xuất kho) with QUOTED column names
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

  -- Insert work order (with additionalServices)
  INSERT INTO work_orders(
    id, customerName, customerPhone, vehicleModel, licensePlate,
    issueDescription, technicianName, status, laborCost, discount,
    partsUsed, additionalServices, total, branchId, paymentStatus,
    paymentMethod, depositAmount, additionalPayment, totalPaid,
    remainingAmount, creationDate, userId
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
    v_creation_date,
    p_user_id
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

  RETURN v_order_row;
END;
$$;
