-- Add inventory_deducted column to track whether stock was already deducted
ALTER TABLE public.work_orders 
ADD COLUMN IF NOT EXISTS inventory_deducted BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.work_orders.inventory_deducted IS 'True if inventory has been deducted from stock (happens when paid)';

-- Drop ALL existing versions of function to avoid ambiguity
DO $$
DECLARE
  func_oid oid;
BEGIN
  FOR func_oid IN 
    SELECT oid FROM pg_proc WHERE proname = 'work_order_complete_payment' AND pronamespace = 'public'::regnamespace
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || func_oid::regprocedure || ' CASCADE';
  END LOOP;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore errors if no functions exist
END $$;

-- Function to complete/pay work order and deduct inventory
CREATE OR REPLACE FUNCTION public.work_order_complete_payment(
  p_order_id TEXT,
  p_payment_method TEXT,
  p_payment_amount NUMERIC,
  p_user_id TEXT
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
  v_new_total_paid NUMERIC;
  v_new_remaining NUMERIC;
  v_new_payment_status TEXT;
  v_result JSONB;
  v_insufficient JSONB := '[]'::jsonb;
BEGIN
  -- Authorization check
  IF NOT public.mc_is_manager_or_owner() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Get existing order with lock
  SELECT * INTO v_order
  FROM work_orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  -- Branch scope guard
  IF v_order.branchid IS DISTINCT FROM public.mc_current_branch() THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH';
  END IF;

  -- Check if already refunded
  IF v_order.refunded = TRUE THEN
    RAISE EXCEPTION 'ORDER_REFUNDED';
  END IF;

  -- Calculate new payment totals
  v_new_total_paid := COALESCE(v_order.totalpaid, 0) + p_payment_amount;
  v_new_remaining := v_order.total - v_new_total_paid;
  
  -- Determine new payment status
  IF v_new_remaining <= 0 THEN
    v_new_payment_status := 'paid';
  ELSIF v_new_total_paid > 0 THEN
    v_new_payment_status := 'partial';
  ELSE
    v_new_payment_status := 'unpaid';
  END IF;

  -- If becoming fully paid and inventory not yet deducted, deduct now
  IF v_new_payment_status = 'paid' AND COALESCE(v_order.inventory_deducted, FALSE) = FALSE THEN
    -- Process each part: release reservation and deduct actual stock
    IF v_order.partsused IS NOT NULL THEN
      FOR v_part IN SELECT * FROM jsonb_array_elements(v_order.partsused)
      LOOP
        v_part_id := (v_part->>'partId');
        v_part_name := (v_part->>'partName');
        v_quantity := COALESCE((v_part->>'quantity')::int, 0);

        IF v_quantity > 0 THEN
          -- Get current stock and reserved with row lock
          SELECT 
            COALESCE((stock->>v_order.branchid)::int, 0),
            COALESCE((reservedstock->>v_order.branchid)::int, 0)
          INTO v_current_stock, v_current_reserved
          FROM parts WHERE id = v_part_id FOR UPDATE;

          IF NOT FOUND THEN
            RAISE EXCEPTION 'PART_NOT_FOUND: %', v_part_id;
          END IF;

          -- Check if enough actual stock
          IF v_current_stock < v_quantity THEN
            v_insufficient := v_insufficient || jsonb_build_object(
              'partId', v_part_id,
              'partName', v_part_name,
              'requested', v_quantity,
              'available', v_current_stock
            );
            CONTINUE;
          END IF;

          -- Release reservation
          UPDATE parts 
          SET reservedstock = jsonb_set(
            COALESCE(reservedstock, '{}'::jsonb),
            ARRAY[v_order.branchid],
            to_jsonb(GREATEST(0, v_current_reserved - v_quantity)),
            true
          )
          WHERE id = v_part_id;

          -- Deduct actual stock
          UPDATE parts 
          SET stock = jsonb_set(
            stock,
            ARRAY[v_order.branchid],
            to_jsonb(v_current_stock - v_quantity),
            true
          )
          WHERE id = v_part_id;

          -- Create inventory transaction (Xuất kho)
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
            public.mc_avg_cost(v_part_id, v_order.branchid),
            public.mc_avg_cost(v_part_id, v_order.branchid) * v_quantity,
            v_order.branchid,
            'Xuất kho khi thanh toán phiếu sửa',
            p_order_id
          );
        END IF;
      END LOOP;

      -- If any insufficient stock, raise error
      IF jsonb_array_length(v_insufficient) > 0 THEN
        RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_insufficient::text;
      END IF;
    END IF;
  END IF;

  -- Create payment transaction
  IF p_payment_amount > 0 AND p_payment_method IS NOT NULL THEN
    v_payment_tx_id := gen_random_uuid()::text;
    INSERT INTO cash_transactions(
      id, category, amount, date, description, "branchId", "paymentSource", reference
    )
    VALUES (
      v_payment_tx_id,
      'service_income',
      p_payment_amount,
      NOW(),
      'Thanh toán phiếu sửa chữa ' || p_order_id,
      v_order.branchid,
      p_payment_method,
      p_order_id
    );
  END IF;

  -- Update work order
  UPDATE work_orders
  SET
    paymentstatus = v_new_payment_status,
    paymentmethod = COALESCE(p_payment_method, paymentmethod),
    totalpaid = v_new_total_paid,
    remainingamount = GREATEST(0, v_new_remaining),
    additionalpayment = COALESCE(additionalpayment, 0) + p_payment_amount,
    cashtransactionid = COALESCE(v_payment_tx_id, cashtransactionid),
    paymentdate = CASE WHEN v_payment_tx_id IS NOT NULL THEN NOW() ELSE paymentdate END,
    inventory_deducted = CASE WHEN v_new_payment_status = 'paid' THEN TRUE ELSE inventory_deducted END
  WHERE id = p_order_id;

  -- Prepare return JSON
  SELECT jsonb_build_object(
    'workOrder', to_jsonb(w.*),
    'paymentTransactionId', v_payment_tx_id,
    'newPaymentStatus', v_new_payment_status,
    'inventoryDeducted', (v_new_payment_status = 'paid')
  ) INTO v_result
  FROM work_orders w WHERE w.id = p_order_id;

  -- Audit log (best-effort)
  BEGIN
    INSERT INTO audit_logs(
      id, user_id, action, table_name, record_id, old_data, new_data, created_at
    )
    VALUES (
      gen_random_uuid()::text,
      COALESCE(p_user_id, NULL),
      'work_order.payment',
      'work_orders',
      p_order_id,
      jsonb_build_object('totalPaid', v_order.totalpaid, 'paymentStatus', v_order.paymentstatus),
      v_result->'workOrder',
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.work_order_complete_payment IS 'Thanh toán phiếu sửa chữa và trừ kho khi đã thanh toán đủ (atomic).';

GRANT EXECUTE ON FUNCTION public.work_order_complete_payment TO authenticated;
