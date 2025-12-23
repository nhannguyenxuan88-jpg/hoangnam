-- Fix cụ thể cho phiếu SC-20251223-316527
-- Thêm costPrice = 550000 cho service "Đổ phòng 28120-KVB-901"

-- Bước 1: Kiểm tra phiếu hiện tại
SELECT 
  id,
  paymentstatus,
  additionalservices,
  jsonb_array_length(COALESCE(additionalservices, '[]'::jsonb)) as service_count
FROM work_orders
WHERE id = 'SC-20251223-316527';

-- Bước 2: Update costPrice cho tất cả services trong phiếu này
UPDATE work_orders
SET additionalservices = (
  SELECT jsonb_agg(
    jsonb_set(
      service,
      '{costPrice}',
      '550000'::jsonb,
      true
    )
  )
  FROM jsonb_array_elements(COALESCE(additionalservices, '[]'::jsonb)) AS service
)
WHERE id = 'SC-20251223-316527'
  AND additionalservices IS NOT NULL
  AND jsonb_array_length(additionalservices) > 0;

-- Bước 3: Verify kết quả
SELECT 
  id,
  additionalservices
FROM work_orders
WHERE id = 'SC-20251223-316527';

-- Bước 4: BACKUP - Nếu không có additionalservices, có thể cần tạo mới
-- (Uncomment và chạy nếu Bước 2 không có kết quả)
/*
UPDATE work_orders
SET additionalservices = jsonb_build_array(
  jsonb_build_object(
    'description', 'Đổ phòng 28120-KVB-901',
    'price', 550000,
    'quantity', 1,
    'costPrice', 550000
  )
)
WHERE id = 'SC-20251223-316527';
*/
