-- Fix sản phẩm có temp ID trong inventory_transactions
-- Vấn đề: Sản phẩm mới được nhập kho nhưng không được tạo trong bảng parts
-- Nguyên nhân: partId vẫn là temp-xxx thay vì UUID thật

-- Bước 1: Tìm tất cả inventory_transactions có temp ID
SELECT 
  it.id as transaction_id,
  it."partId" as temp_part_id,
  it."partName",
  it.quantity,
  it.date,
  it."branchId",
  it."unitPrice",
  p.id as part_exists
FROM inventory_transactions it
LEFT JOIN parts p ON it."partId" = p.id
WHERE it."partId" LIKE 'temp-%'
ORDER BY it.date DESC;

-- Bước 2: Fix cho sản phẩm "Bộ nắp trước tay lái "NHB35P""
DO $$
DECLARE
  v_new_part_id UUID;
  v_temp_part_id TEXT := 'temp-1765095159201-dbdvhkdgw06';
  v_branch_id TEXT := 'CN1'; -- Thay đổi nếu cần
  v_part_exists UUID;
BEGIN
  -- Kiểm tra xem part với tên này đã tồn tại chưa
  SELECT id INTO v_part_exists
  FROM parts
  WHERE name = 'Bộ nắp trước tay lái "NHB35P"'
  LIMIT 1;

  IF v_part_exists IS NOT NULL THEN
    -- Part đã tồn tại, chỉ cần update inventory_transactions
    RAISE NOTICE 'Part đã tồn tại với ID: %, đang cập nhật transactions...', v_part_exists;
    v_new_part_id := v_part_exists;
  ELSE
    -- 2.1: Tạo part mới với UUID thật
    INSERT INTO parts (
      id,
      name,
      sku,
      stock,
      "retailPrice",
      "wholesalePrice",
      "costPrice",
      category
    ) VALUES (
      gen_random_uuid(),
      'Bộ nắp trước tay lái "NHB35P"',
      'NHB35P',
      jsonb_build_object(v_branch_id, 1), -- Số lượng từ inventory_transactions
      jsonb_build_object(v_branch_id, 285000),
      jsonb_build_object(v_branch_id, 0),
      jsonb_build_object(v_branch_id, 285000),
      'Phụ tùng'
    )
    RETURNING id INTO v_new_part_id;

    RAISE NOTICE 'Đã tạo part mới với ID: %', v_new_part_id;
  END IF;

  -- 2.2: Cập nhật TẤT CẢ inventory_transactions có temp ID này
  UPDATE inventory_transactions
  SET "partId" = v_new_part_id::TEXT
  WHERE "partId" = v_temp_part_id;

  RAISE NOTICE 'Đã cập nhật % transactions', (SELECT COUNT(*) FROM inventory_transactions WHERE "partId" = v_new_part_id::TEXT);

END $$;

-- Bước 3: Kiểm tra lại - Phải thấy part với UUID thật
SELECT 
  it.id as transaction_id,
  it."partId",
  it."partName",
  it.quantity,
  p.id as part_id,
  p.name as part_actual_name,
  p.stock,
  p.sku
FROM inventory_transactions it
LEFT JOIN parts p ON it."partId" = p.id
WHERE it."partName" LIKE '%Bộ nắp trước tay lái%'
ORDER BY it.date DESC;

-- Bước 3.5: Kiểm tra xem còn temp ID nào không
SELECT 
  it."partId" as temp_part_id,
  it."partName",
  COUNT(*) as transaction_count
FROM inventory_transactions it
WHERE it."partId" LIKE 'temp-%'
GROUP BY it."partId", it."partName";

-- Bước 3.6: Tìm part trong bảng parts theo tên hoặc SKU
SELECT id, name, sku, stock, "retailPrice"
FROM parts
WHERE name LIKE '%nắp trước tay lái%'
  OR name LIKE '%NHB35P%'
  OR sku = 'NHB35P';

-- Bước 4: Script tổng quát để fix TẤT CẢ temp ID
-- CHÚ Ý: Script này sẽ tạo parts cho tất cả temp ID
-- Chỉ chạy nếu chắc chắn muốn fix toàn bộ

/*
DO $$
DECLARE
  v_record RECORD;
  v_new_part_id UUID;
BEGIN
  FOR v_record IN (
    SELECT DISTINCT
      it."partId" as temp_id,
      it."partName" as name,
      it."branchId" as branch_id,
      SUM(
        CASE 
          WHEN it.type = 'Nhập kho' THEN it.quantity
          WHEN it.type = 'Xuất kho' THEN -it.quantity
          ELSE 0
        END
      ) as total_stock,
      MAX(it."unitPrice") as last_price
    FROM inventory_transactions it
    LEFT JOIN parts p ON it."partId" = p.id
    WHERE it."partId" LIKE 'temp-%'
      AND p.id IS NULL
    GROUP BY it."partId", it."partName", it."branchId"
  ) LOOP
    -- Tạo part mới
    INSERT INTO parts (
      id,
      name,
      sku,
      stock,
      "retailPrice",
      "wholesalePrice",
      "costPrice",
      category
    ) VALUES (
      gen_random_uuid(),
      v_record.name,
      SUBSTRING(v_record.temp_id FROM 6 FOR 8), -- Generate SKU from temp ID
      jsonb_build_object(v_record.branch_id, GREATEST(v_record.total_stock, 0)),
      jsonb_build_object(v_record.branch_id, v_record.last_price),
      jsonb_build_object(v_record.branch_id, 0),
      jsonb_build_object(v_record.branch_id, v_record.last_price),
      'Phụ tùng'
    )
    RETURNING id INTO v_new_part_id;

    -- Cập nhật inventory_transactions
    UPDATE inventory_transactions
    SET "partId" = v_new_part_id::TEXT
    WHERE "partId" = v_record.temp_id;

    RAISE NOTICE 'Fixed: % -> %', v_record.temp_id, v_new_part_id;
  END LOOP;
END $$;
*/

-- Bước 5: Sau khi fix, verify không còn temp ID
SELECT COUNT(*) as temp_count
FROM inventory_transactions
WHERE "partId" LIKE 'temp-%';
