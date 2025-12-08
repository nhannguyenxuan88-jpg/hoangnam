-- Script đơn giản hơn để tạo sản phẩm "Bộ nắp trước tay lái NHB35P"
-- Chạy từng bước và kiểm tra kết quả

-- BƯỚC 1: Kiểm tra xem sản phẩm đã tồn tại chưa
SELECT 
  'Part exists' as status,
  id, 
  name, 
  sku, 
  stock
FROM parts 
WHERE sku = 'NHB35P' OR name LIKE '%NHB35P%';

-- BƯỚC 2: Nếu không có kết quả ở Bước 1, chạy script này để tạo
-- (Nếu đã có, BỎ QUA bước này)
INSERT INTO parts (
  id,
  name,
  sku,
  stock,
  "retailPrice",
  "wholesalePrice",
  category
) VALUES (
  gen_random_uuid(),
  'Bộ nắp trước tay lái NHB35P',  -- BỎ dấu ngoặc kép để dễ tìm
  'NHB35P',
  '{"CN1": 1}'::jsonb,
  '{"CN1": 285000}'::jsonb,
  '{"CN1": 0}'::jsonb,
  'Phụ tùng'
)
RETURNING id, name, sku;

-- BƯỚC 3: Kiểm tra lại
SELECT 
  id, 
  name, 
  sku, 
  stock,
  "retailPrice"
FROM parts 
WHERE sku = 'NHB35P';

-- BƯỚC 4: Nếu part đã được tạo, cập nhật inventory_transactions
UPDATE inventory_transactions
SET "partId" = (SELECT id::text FROM parts WHERE sku = 'NHB35P' LIMIT 1)
WHERE "partId" = 'temp-1765095159201-dbdvhkdgw06';

-- BƯỚC 5: Verify - Không còn temp ID
SELECT COUNT(*) as remaining_temp_ids
FROM inventory_transactions
WHERE "partId" LIKE 'temp-%';

-- BƯỚC 6: Kiểm tra transaction đã được update đúng chưa
SELECT 
  it."partId",
  it."partName",
  p.name as part_actual_name,
  p.sku
FROM inventory_transactions it
LEFT JOIN parts p ON it."partId" = p.id
WHERE it."partName" LIKE '%nắp trước%'
LIMIT 5;
