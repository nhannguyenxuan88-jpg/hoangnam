-- Fix work_order_refund_atomic: Complete rewrite matching the style of work_order_create_atomic
-- Key insight: Existing functions use unquoted camelCase column names which PostgreSQL
-- normalizes to lowercase. The working create_atomic function proves this works.

-- First, add the 'type' column if it doesn't exist
ALTER TABLE cash_transactions ADD COLUMN IF NOT EXISTS type TEXT;

-- Drop existing function first to ensure clean state
DROP FUNCTION IF EXISTS public.work_order_refund_atomic(TEXT, TEXT, TEXT);

-- Recreate the function matching the exact style of work_order_create_atomic
CREATE OR REPLACE FUNCTION public.work_order_refund_atomic(
  p_order_id TEXT,
  p_refund_reason TEXT,
  p_user_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_order_row RECORD;
  v_part JSONB;
  v_index INT := 0;
  v_parts_count INT;
  v_part_id TEXT;
  v_part_name TEXT;
  v_quantity INT;
  v_current_stock INT;
  v_refund_tx_id TEXT;
  v_total_refund NUMERIC := 0;
  v_branch_id TEXT;
  v_payment_method TEXT;
  v_parts_used JSONB;
  v_result JSONB;
BEGIN
  -- Authorization check
  IF NOT public.mc_is_manager_or_owner() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;

  -- Get existing order
  SELECT * INTO v_order_row
  FROM work_orders
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  -- Check if already refunded
  IF v_order_row.refunded = TRUE THEN
    RAISE EXCEPTION 'ALREADY_REFUNDED';
  END IF;

  -- Extract values into local variables (this is how the working function does it)
  v_branch_id := v_order_row.branchid;
  v_payment_method := v_order_row.paymentmethod;
  v_parts_used := v_order_row.partsused;
  v_total_refund := COALESCE(v_order_row.totalpaid, 0);

  -- Branch scope guard
  IF v_branch_id IS DISTINCT FROM public.mc_current_branch() THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH';
  END IF;

  -- 🔹 STEP 1: Restore inventory for all parts (matching create_atomic style)
  v_parts_count := COALESCE(jsonb_array_length(v_parts_used), 0);
  
  IF v_parts_count > 0 THEN
    FOR v_index IN 0..(v_parts_count - 1) LOOP
      v_part := v_parts_used->v_index;
      v_part_id := (v_part->>'partId');
      v_part_name := (v_part->>'partName');
      v_quantity := COALESCE((v_part->>'quantity')::int, 0);

      IF v_quantity > 0 AND v_part_id IS NOT NULL THEN
        -- Get current stock with row lock
        SELECT COALESCE((stock->>v_branch_id)::int, 0) INTO v_current_stock
        FROM parts WHERE id = v_part_id FOR UPDATE;

        IF FOUND THEN
          -- Restore stock (add back)
          UPDATE parts
          SET stock = jsonb_set(
            stock, 
            ARRAY[v_branch_id], 
            to_jsonb(v_current_stock + v_quantity), 
            true
          )
          WHERE id = v_part_id;

          -- Create inventory transaction (Nhập kho - refund)
          -- Matching exact column style from work_order_create_atomic
          INSERT INTO inventory_transactions(
            id, type, partId, partName, quantity, date, unitPrice, totalPrice,
            branchId, notes, workOrderId
          )
          VALUES (
            gen_random_uuid()::text,
            'Nhập kho',
            v_part_id,
            v_part_name,
            v_quantity,
            NOW(),
            COALESCE(public.mc_avg_cost(v_part_id, v_branch_id), 0),
            COALESCE(public.mc_avg_cost(v_part_id, v_branch_id), 0) * v_quantity,
            v_branch_id,
            'Hoàn trả do hủy phiếu: ' || COALESCE(p_refund_reason, 'Không rõ'),
            p_order_id
          );
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 🔹 STEP 2: Create refund cash transaction if customer paid anything
  IF v_total_refund > 0 AND v_payment_method IS NOT NULL THEN
    v_refund_tx_id := gen_random_uuid()::text;
    
    -- Matching exact column style from work_order_create_atomic
    INSERT INTO cash_transactions(
      id, type, category, amount, date, description, branchId, paymentSource, reference
    )
    VALUES (
      v_refund_tx_id,
      'expense',
      'sale_refund',
      v_total_refund,
      NOW(),
      'Hoàn tiền hủy phiếu ' || p_order_id || ' - ' || COALESCE(p_refund_reason, ''),
      v_branch_id,
      v_payment_method,
      p_order_id
    );
  END IF;

  -- 🔹 STEP 3: Mark order as refunded
  UPDATE work_orders
  SET
    refunded = TRUE,
    refunded_at = NOW(),
    refund_transaction_id = v_refund_tx_id,
    refund_reason = p_refund_reason,
    status = 'Đã hủy',
    paymentStatus = 'refunded'
  WHERE id = p_order_id;

  -- Prepare return JSON
  SELECT jsonb_build_object(
    'workOrder', to_jsonb(w.*),
    'refund_transaction_id', v_refund_tx_id,
    'refundAmount', v_total_refund
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
      'work_order.refund',
      'work_orders',
      p_order_id,
      to_jsonb(v_order_row),
      v_result->'workOrder',
      NOW()
    );
  EXCEPTION WHEN OTHERS THEN
    NULL; -- swallow audit errors
  END;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE; -- Rollback on any error
END;
$$;

COMMENT ON FUNCTION public.work_order_refund_atomic IS 'Hoàn tiền và restore inventory cho phiếu sửa chữa bị hủy (atomic).';

-- Grant execute to authenticated role
GRANT EXECUTE ON FUNCTION public.work_order_refund_atomic(TEXT, TEXT, TEXT) TO authenticated;
