-- Fix Quick Service Support in sale_create_atomic
-- Date: 2025-12-20
-- Issue: The 2025-12-18 migration removed quick service support. This restores it.
-- Quick services have partId starting with 'quick_service_' or isService = true and skip stock operations

CREATE OR REPLACE FUNCTION public.sale_create_atomic(
  p_sale_id TEXT,
  p_items JSONB,
  p_discount NUMERIC,
  p_customer JSONB,
  p_payment_method TEXT,
  p_user_id UUID,
  p_user_name TEXT,
  p_branch_id TEXT
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_subtotal NUMERIC := 0;
  v_total NUMERIC := 0;
  v_item JSONB;
  v_index INT := 0;
  v_items_count INT := jsonb_array_length(p_items);
  v_part_id TEXT;
  v_part_name TEXT;
  v_quantity INT;
  v_price NUMERIC;
  v_current_stock INT;
  v_sale_row JSONB;
  v_cash_tx_id TEXT := gen_random_uuid()::text;
  v_inventory_tx_count INT := 0;
  v_insufficient JSONB := '[]'::jsonb;
  v_sale_code TEXT;
  v_is_quick_service BOOLEAN;
BEGIN
  -- Authorization & branch scope guard
  IF NOT public.mc_is_manager_or_owner() THEN
    RAISE EXCEPTION 'UNAUTHORIZED';
  END IF;
  IF p_branch_id IS DISTINCT FROM public.mc_current_branch() THEN
    RAISE EXCEPTION 'BRANCH_MISMATCH';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR v_items_count = 0 THEN
    RAISE EXCEPTION 'EMPTY_ITEMS';
  END IF;
  IF p_payment_method NOT IN ('cash','bank') THEN
    RAISE EXCEPTION 'INVALID_PAYMENT_METHOD';
  END IF;

  -- Calculate subtotal (all items including quick services)
  FOR v_index IN 0..(v_items_count - 1) LOOP
    v_item := p_items->v_index;
    v_part_id := (v_item->>'partId');
    v_part_name := COALESCE((v_item->>'partName'), (v_item->>'name'));
    v_quantity := COALESCE((v_item->>'quantity')::int, 0);
    v_price := COALESCE((v_item->>'sellingPrice')::numeric, (v_item->>'price')::numeric, 0);
    
    IF v_part_id IS NULL OR v_quantity <= 0 THEN
      RAISE EXCEPTION 'INVALID_ITEM';
    END IF;
    v_subtotal := v_subtotal + (v_price * v_quantity);
  END LOOP;

  v_total := GREATEST(0, v_subtotal - COALESCE(p_discount, 0));

  -- Validate and decrement stock (skip for quick services)
  FOR v_index IN 0..(v_items_count - 1) LOOP
    v_item := p_items->v_index;
    v_part_id := (v_item->>'partId');
    v_part_name := COALESCE((v_item->>'partName'), (v_item->>'name'));
    v_quantity := COALESCE((v_item->>'quantity')::int, 0);
    
    -- Check if this is a quick service (skip stock operations)
    -- Support both: partId starting with 'quick_service_' OR isService = true
    v_is_quick_service := (v_part_id LIKE 'quick_service_%') OR COALESCE((v_item->>'isService')::boolean, false);
    
    IF v_is_quick_service THEN
      -- Quick service: no stock deduction, no inventory transaction
      CONTINUE;
    END IF;

    -- Regular part: check and decrement stock
    SELECT COALESCE((stock->>p_branch_id)::int, 0) INTO v_current_stock 
    FROM parts WHERE id = v_part_id FOR UPDATE;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'PART_NOT_FOUND';
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
    UPDATE parts SET stock = jsonb_set(stock, ARRAY[p_branch_id], to_jsonb(v_current_stock - v_quantity), true) 
    WHERE id = v_part_id;

    -- Insert inventory_transactions with QUOTED column names
    INSERT INTO inventory_transactions(id, type, "partId", "partName", quantity, date, "unitPrice", "totalPrice", "branchId", notes, "saleId")
    VALUES (
      gen_random_uuid()::text,
      'Xuất kho',
      v_part_id,
      v_part_name,
      v_quantity,
      NOW(),
      public.mc_avg_cost(v_part_id, p_branch_id),
      public.mc_avg_cost(v_part_id, p_branch_id) * v_quantity,
      p_branch_id,
      'Bán hàng',
      p_sale_id
    );
    v_inventory_tx_count := v_inventory_tx_count + 1;
  END LOOP;

  IF jsonb_array_length(v_insufficient) > 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_insufficient::text;
  END IF;

  -- Insert sale and capture the generated sale_code
  INSERT INTO sales(id, date, items, subtotal, discount, total, customer, paymentmethod, userid, username, branchid)
  VALUES (p_sale_id, NOW(), p_items, v_subtotal, p_discount, v_total, p_customer, p_payment_method, p_user_id, p_user_name, p_branch_id)
  RETURNING sale_code INTO v_sale_code;

  -- Cash transaction with readable description using sale_code
  INSERT INTO cash_transactions(id, type, category, amount, date, description, branchid, paymentsource, reference)
  VALUES (
    v_cash_tx_id, 
    'income', 
    'sale_income', 
    v_total, 
    NOW(), 
    'Thu từ hóa đơn ' || COALESCE(v_sale_code, p_sale_id),
    p_branch_id, 
    p_payment_method, 
    COALESCE(v_sale_code, p_sale_id)
  );

  RETURN jsonb_build_object(
    'sale', (SELECT row_to_json(s) FROM sales s WHERE s.id = p_sale_id),
    'cashTransactionId', v_cash_tx_id,
    'inventoryTxCount', v_inventory_tx_count
  );
END;
$$;

COMMENT ON FUNCTION public.sale_create_atomic IS 'Tạo hóa đơn và cập nhật tồn kho + giao dịch tiền mặt trong 1 transaction (atomic). Hỗ trợ quick_service không cần trừ kho.';

GRANT EXECUTE ON FUNCTION public.sale_create_atomic TO authenticated;
