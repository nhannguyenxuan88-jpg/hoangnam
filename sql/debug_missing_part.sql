-- Debug: Kiểm tra sản phẩm "Bộ nắp trước tay lái" có tồn tại không
-- Chạy script này để kiểm tra

-- 1. Tìm theo tên chính xác
SELECT id, name, sku, stock, category 
FROM parts 
WHERE name LIKE '%nắp trước tay lái%';

-- 2. Tìm theo SKU
SELECT id, name, sku, stock, category 
FROM parts 
WHERE sku = 'NHB35P';

-- 3. Tìm theo tên có dấu ngoặc kép
SELECT id, name, sku, stock, category 
FROM parts 
WHERE name LIKE '%"NHB35P"%';

-- 4. Tìm tất cả sản phẩm nhập trong phiếu NH-20251207-011
SELECT 
  it.id,
  it."partId",
  it."partName",
  it.quantity,
  it.date,
  p.name as part_actual_name,
  p.sku,
  p.stock
FROM inventory_transactions it
LEFT JOIN parts p ON it."partId" = p.id
WHERE it.notes LIKE '%NH-20251207-011%'
  OR it.date::date = '2025-12-07'
ORDER BY it.date DESC
LIMIT 20;

-- 5. Kiểm tra stock của sản phẩm này (nếu tìm thấy)
SELECT 
  id,
  name,
  sku,
  stock,
  "retailPrice",
  "costPrice"
FROM parts
WHERE name ILIKE '%bộ nắp%'
  OR name ILIKE '%nắp trước%'
  OR sku ILIKE '%NHB35P%';
