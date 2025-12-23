-- Backfill costPrice cho additionalServices từ cash_transactions
-- Script này sẽ thêm costPrice vào additionalServices dựa trên phiếu chi gia công đã tạo

DO $$
DECLARE
  v_order RECORD;
  v_service JSONB;
  v_services JSONB;
  v_updated_services JSONB;
  v_tx RECORD;
  v_total_service_cost NUMERIC;
  v_service_count INT;
  v_cost_per_service NUMERIC;
  v_updated_count INT := 0;
BEGIN
  -- Lặp qua tất cả work orders có additionalServices
  FOR v_order IN 
    SELECT id, additionalservices, branchid
    FROM work_orders
    WHERE additionalservices IS NOT NULL 
      AND jsonb_array_length(additionalservices) > 0
      AND paymentstatus = 'paid'
  LOOP
    v_services := v_order.additionalservices;
    v_updated_services := '[]'::jsonb;
    v_service_count := jsonb_array_length(v_services);
    
    -- Tìm phiếu chi gia công tương ứng
    SELECT amount INTO v_tx
    FROM cash_transactions
    WHERE reference = v_order.id
      AND category = 'outsourcing'
      AND type = 'expense'
    LIMIT 1;
    
    -- Nếu có phiếu chi gia công
    IF FOUND THEN
      v_total_service_cost := ABS(v_tx.amount);
      
      -- Chia đều chi phí cho các service (hoặc có thể dùng logic phức tạp hơn)
      v_cost_per_service := v_total_service_cost / v_service_count;
      
      -- Cập nhật từng service
      FOR i IN 0..v_service_count-1 LOOP
        v_service := v_services->i;
        
        -- Chỉ thêm costPrice nếu chưa có
        IF v_service->>'costPrice' IS NULL THEN
          v_service := jsonb_set(
            v_service,
            '{costPrice}',
            to_jsonb(v_cost_per_service),
            true
          );
        END IF;
        
        v_updated_services := v_updated_services || jsonb_build_array(v_service);
      END LOOP;
      
      -- Update work order
      UPDATE work_orders
      SET additionalservices = v_updated_services
      WHERE id = v_order.id;
      
      v_updated_count := v_updated_count + 1;
      
      RAISE NOTICE 'Updated work order %: % services with cost % each', 
        v_order.id, v_service_count, v_cost_per_service;
    ELSE
      -- Nếu không có phiếu chi, thử tính từ price (giả sử costPrice = 0 hoặc giữ nguyên)
      FOR i IN 0..v_service_count-1 LOOP
        v_service := v_services->i;
        
        -- Nếu chưa có costPrice, set = 0 (hoặc có thể = price tùy logic)
        IF v_service->>'costPrice' IS NULL THEN
          -- Option 1: Set = 0
          v_service := jsonb_set(v_service, '{costPrice}', '0', true);
          
          -- Option 2: Set = price (uncomment nếu muốn dùng)
          -- v_service := jsonb_set(
          --   v_service,
          --   '{costPrice}',
          --   v_service->'price',
          --   true
          -- );
        END IF;
        
        v_updated_services := v_updated_services || jsonb_build_array(v_service);
      END LOOP;
      
      -- Update work order
      UPDATE work_orders
      SET additionalservices = v_updated_services
      WHERE id = v_order.id;
      
      RAISE NOTICE 'Updated work order % (no expense tx): % services with costPrice = 0', 
        v_order.id, v_service_count;
    END IF;
  END LOOP;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Backfill completed! Updated % work orders', v_updated_count;
  RAISE NOTICE '========================================';
END $$;

-- Verify kết quả
SELECT 
  id,
  jsonb_array_length(additionalservices) as service_count,
  additionalservices
FROM work_orders
WHERE additionalservices IS NOT NULL 
  AND jsonb_array_length(additionalservices) > 0
ORDER BY creationdate DESC
LIMIT 10;
