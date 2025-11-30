-- Updated work_order_create_atomic: Reserve stock instead of deducting
-- Stock is only deducted when work order is completed/paid
-- This version RESERVES stock and warns if insufficient

DROP FUNCTION IF EXISTS public.work_order_create_atomic;

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
  v_is_paid BOOLEAN;
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

  -- Check if fully paid
  v_is_paid := (p_payment_status = 'paid');

  -- Process parts
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

      -- Get current stock and reserved with row lock
      SELECT 
        COALESCE((stock->>p_branch_id)::int, 0),
        COALESCE((reservedStock->>p_branch_id)::int, 0)
      INTO v_current_stock, v_current_reserved
      FROM parts WHERE id = v_part_id FOR UPDATE;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'PART_NOT_FOUND: %', v_part_id;
      END IF;

      v_available := v_current_stock - v_current_reserved;

      -- Check if enough available stock
      IF v_available < v_quantity THEN
        -- Add warning but still allow creation
        v_warnings := v_warnings || jsonb_build_object(
          'partId', v_part_id,
          'partName', v_part_name,
          'requested', v_quantity,
          'available', v_available,
          'shortage', v_quantity - v_available
        );
      END IF;

      IF v_is_paid THEN
        -- If paid immediately: deduct actual stock and create inventory transaction
        IF v_current_stock < v_quantity THEN
          RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', jsonb_build_array(jsonb_build_object(
            'partId', v_part_id,
            'partName', v_part_name,
            'requested', v_quantity,
            'available', v_current_stock
          ))::text;
        END IF;

        -- Deduct actual stock
        UPDATE parts 
        SET stock = jsonb_set(stock, ARRAY[p_branch_id], to_jsonb(v_current_stock - v_quantity), true) 
        WHERE id = v_part_id;

        -- Insert inventory_transactions (Xuất kho)
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
          v_creation_date,
          public.mc_avg_cost(v_part_id, p_branch_id),
          public.mc_avg_cost(v_part_id, p_branch_id) * v_quantity,
          p_branch_id,
          'Sử dụng cho sửa chữa (thanh toán ngay)',
          p_order_id
        );
      ELSE
        -- Not paid: only reserve stock (no deduction yet)
        UPDATE parts 
        SET reservedStock = jsonb_set(
          COALESCE(reservedStock, '{}'::jsonb), 
          ARRAY[p_branch_id], 
          to_jsonb(v_current_reserved + v_quantity), 
          true
        ) 
        WHERE id = v_part_id;
      END IF;
    END LOOP;
  END IF;

  -- Insert work order with inventory_deducted flag
  INSERT INTO work_orders(
    id, customerName, customerPhone, vehicleModel, licensePlate,
    issueDescription, technicianName, status, laborCost, discount,
    partsUsed, additionalServices, total, branchId, paymentStatus,
    paymentMethod, depositAmount, additionalPayment, totalPaid,
    remainingAmount, creationDate, inventory_deducted
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
    v_is_paid -- Track whether inventory was already deducted
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

    UPDATE work_orders 
    SET cashTransactionId = v_payment_tx_id, paymentDate = v_creation_date
    WHERE id = p_order_id;
  END IF;

  -- Prepare return JSON with warnings
  SELECT jsonb_build_object(
    'workOrder', to_jsonb(w.*),
    'depositTransactionId', v_deposit_tx_id,
    'paymentTransactionId', v_payment_tx_id,
    'stockWarnings', v_warnings,
    'inventoryDeducted', v_is_paid
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

COMMENT ON FUNCTION public.work_order_create_atomic IS 'Tạo phiếu sửa chữa: đặt trước tồn kho nếu chưa thanh toán, trừ kho nếu đã thanh toán (atomic).';

GRANT EXECUTE ON FUNCTION public.work_order_create_atomic TO authenticated;
