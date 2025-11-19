-- ============================================
-- FIX: Remove "cost" column from work_order_create_atomic
-- The inventory_transactions table uses "unitPrice" and "totalPrice", not "cost"
-- ============================================

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
  v_quantity NUMERIC;
  v_current_stock NUMERIC;
  v_insufficient JSONB := '[]'::jsonb;
  v_creation_date TIMESTAMPTZ := NOW();
  v_deposit_tx_id TEXT := NULL;
  v_payment_tx_id TEXT := NULL;
  v_order_row JSONB;
  v_inventory_tx_count INT := 0;
BEGIN
  -- Validate status
  IF p_status NOT IN ('Tiếp nhận', 'Đang sửa', 'Đã hoàn thành', 'Đã hủy') THEN
    RAISE EXCEPTION 'INVALID_STATUS';
  END IF;

  -- Validate payment_status
  IF p_payment_status NOT IN ('unpaid', 'partial', 'paid') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS';
  END IF;

  -- Process parts (decrement stock + create inventory transactions)
  IF v_parts_count > 0 THEN
    FOR v_index IN 0..(v_parts_count - 1) LOOP
      v_part := p_parts_used->v_index;
      v_part_id := (v_part->>'partId');
      v_part_name := (v_part->>'partName');
      v_quantity := (v_part->>'quantity')::numeric;

      -- Validate part exists
      IF NOT EXISTS (SELECT 1 FROM parts WHERE id = v_part_id) THEN
        RAISE EXCEPTION 'PART_NOT_FOUND:%', v_part_id;
      END IF;

      -- Get current stock
      SELECT COALESCE((stock->>p_branch_id)::numeric, 0) INTO v_current_stock
      FROM parts WHERE id = v_part_id;

      -- Check stock availability
      IF v_current_stock IS NULL THEN
        v_current_stock := 0;
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

      -- Insert inventory_transactions (Xuất kho) - NO "cost" column!
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

  -- Insert work order (with additionalServices AND userId)
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
    p_payment_method, p_deposit_amount, p_additional_payment,
    p_deposit_amount + p_additional_payment,
    p_total - (p_deposit_amount + p_additional_payment),
    v_creation_date, p_user_id
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

    -- Update work order with deposit transaction ID
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
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error creating work order: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.work_order_create_atomic IS 'Tạo phiếu sửa chữa atomic - Fixed: no "cost" column in inventory_transactions';
GRANT EXECUTE ON FUNCTION public.work_order_create_atomic TO anon, authenticated;
