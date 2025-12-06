-- Migration: Add currentKm parameter to work order atomic functions
-- Date: 2025-12-06
-- Purpose: Allow saving vehicle mileage when creating/updating work orders

-- ============================================================
-- 1. Drop existing function first (to avoid signature conflicts)
-- ============================================================

DROP FUNCTION IF EXISTS public.work_order_create_atomic;

-- ============================================================
-- 2. Create new function with currentKm support
-- ============================================================

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
  p_user_id TEXT,
  p_vehicle_id TEXT DEFAULT NULL,  -- Optional: vehicleId support
  p_current_km INTEGER DEFAULT NULL  -- Optional: Current mileage
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

  -- Validate payment status
  IF p_payment_status NOT IN ('unpaid', 'paid', 'partial') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_STATUS: Must be unpaid, paid, or partial';
  END IF;

  -- Reserve stock for each part (not deduct yet)
  IF v_parts_count > 0 THEN
    WHILE v_index < v_parts_count LOOP
      v_part := p_parts_used->v_index;
      v_part_id := v_part->>'partId';
      v_part_name := v_part->>'partName';
      v_quantity := COALESCE((v_part->>'quantity')::INT, 0);

      IF v_quantity > 0 THEN
        SELECT 
          COALESCE((stock->>p_branch_id)::INT, 0),
          COALESCE((reserved->>p_branch_id)::INT, 0)
        INTO v_current_stock, v_current_reserved
        FROM parts
        WHERE id = v_part_id;

        v_available := v_current_stock - v_current_reserved;

        IF v_available < v_quantity THEN
          v_warnings := v_warnings || jsonb_build_object(
            'partId', v_part_id,
            'partName', v_part_name,
            'requested', v_quantity,
            'available', v_available
          );
        END IF;

        -- Increase reserved stock
        UPDATE parts
        SET reserved = jsonb_set(
          COALESCE(reserved, '{}'::jsonb),
          ARRAY[p_branch_id],
          to_jsonb(COALESCE((reserved->>p_branch_id)::INT, 0) + v_quantity)
        )
        WHERE id = v_part_id;
      END IF;

      v_index := v_index + 1;
    END LOOP;
  END IF;

  -- Insert work order with currentKm
  INSERT INTO work_orders(
    id, customerName, customerPhone, vehicleId, vehicleModel, licensePlate,
    currentKm, issueDescription, technicianName, status, laborCost, discount,
    partsUsed, additionalServices, total, branchId, paymentStatus,
    paymentMethod, depositAmount, additionalPayment, totalPaid,
    remainingAmount, creationDate
  )
  VALUES (
    p_order_id, p_customer_name, p_customer_phone, p_vehicle_id, p_vehicle_model, p_license_plate,
    p_current_km, p_issue_description, p_technician_name, p_status, p_labor_cost, p_discount,
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

  -- Return success with warnings
  RETURN jsonb_build_object(
    'success', true,
    'orderId', p_order_id,
    'depositTransactionId', v_deposit_tx_id,
    'paymentTransactionId', v_payment_tx_id,
    'inventoryTxCount', v_parts_count,
    'warnings', v_warnings
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.work_order_create_atomic TO authenticated;
COMMENT ON FUNCTION public.work_order_create_atomic IS 'Tạo phiếu sửa chữa với currentKm - CHỈ đặt trước tồn kho (reserve), KHÔNG trừ kho thực';

-- Note: You need to run this migration in Supabase SQL Editor
-- After running, the function will accept p_current_km parameter
