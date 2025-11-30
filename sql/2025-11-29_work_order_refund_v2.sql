-- Updated work_order_refund_atomic: Handle reserved stock properly
-- If inventory not deducted: release reservations
-- If inventory deducted: restore actual stock

DROP FUNCTION IF EXISTS public.work_order_refund_atomic;

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
  v_part_id TEXT;
  v_part_name TEXT;
  v_quantity INT;
  v_current_stock INT;
  v_current_reserved INT;
  v_refund_tx_id TEXT;
  v_total_refund NUMERIC := 0;
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

  -- Branch scope guard
  IF v_order_row.branchId IS DISTINCT FROM public.mc_current_branch() THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH';
  END IF;

  -- 🔹 STEP 1: Handle inventory based on whether it was deducted
  IF v_order_row.partsUsed IS NOT NULL THEN
    FOR v_part IN SELECT * FROM jsonb_array_elements(v_order_row.partsUsed)
    LOOP
      v_part_id := (v_part->>'partId');
      v_part_name := (v_part->>'partName');
      v_quantity := COALESCE((v_part->>'quantity')::int, 0);

      IF v_quantity > 0 THEN
        -- Get current stock and reserved with row lock
        SELECT 
          COALESCE((stock->>v_order_row.branchId)::int, 0),
          COALESCE((reservedStock->>v_order_row.branchId)::int, 0)
        INTO v_current_stock, v_current_reserved
        FROM parts WHERE id = v_part_id FOR UPDATE;

        IF FOUND THEN
          IF COALESCE(v_order_row.inventory_deducted, FALSE) THEN
            -- Inventory was deducted: restore actual stock
            UPDATE parts
            SET stock = jsonb_set(
              stock, 
              ARRAY[v_order_row.branchId], 
              to_jsonb(v_current_stock + v_quantity), 
              true
            )
            WHERE id = v_part_id;

            -- Create inventory transaction (Nhập kho - refund)
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
              public.mc_avg_cost(v_part_id, v_order_row.branchId),
              public.mc_avg_cost(v_part_id, v_order_row.branchId) * v_quantity,
              v_order_row.branchId,
              'Hoàn trả do hủy phiếu: ' || COALESCE(p_refund_reason, 'Không rõ'),
              p_order_id
            );
          ELSE
            -- Inventory not deducted: just release reservation
            UPDATE parts
            SET reservedStock = jsonb_set(
              COALESCE(reservedStock, '{}'::jsonb),
              ARRAY[v_order_row.branchId],
              to_jsonb(GREATEST(0, v_current_reserved - v_quantity)),
              true
            )
            WHERE id = v_part_id;
          END IF;
        END IF;
      END IF;
    END LOOP;
  END IF;

  -- 🔹 STEP 2: Calculate total refund amount
  v_total_refund := COALESCE(v_order_row.totalPaid, 0);

  -- Create refund cash transaction if customer paid anything
  IF v_total_refund > 0 AND v_order_row.paymentMethod IS NOT NULL THEN
    v_refund_tx_id := gen_random_uuid()::text;
    
    INSERT INTO cash_transactions(
      id, category, amount, date, description, branchId, paymentSource, reference
    )
    VALUES (
      v_refund_tx_id,
      'refund',
      -v_total_refund, -- Negative amount for refund
      NOW(),
      'Hoàn tiền hủy phiếu ' || p_order_id || ' - ' || COALESCE(p_refund_reason, ''),
      v_order_row.branchId,
      v_order_row.paymentMethod,
      p_order_id
    );
  END IF;

  -- Mark order as refunded
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
    'refundAmount', v_total_refund,
    'inventoryRestored', COALESCE(v_order_row.inventory_deducted, FALSE),
    'reservationsReleased', NOT COALESCE(v_order_row.inventory_deducted, FALSE)
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
    NULL;
  END;

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RAISE;
END;
$$;

COMMENT ON FUNCTION public.work_order_refund_atomic IS 'Hoàn tiền và giải phóng tồn kho (hoặc đặt trước) cho phiếu sửa chữa bị hủy (atomic).';

GRANT EXECUTE ON FUNCTION public.work_order_refund_atomic TO authenticated;
