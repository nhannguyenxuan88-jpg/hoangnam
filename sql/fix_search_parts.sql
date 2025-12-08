-- Cải thiện tìm kiếm phụ tùng trong Supabase
-- Fix: Tìm kiếm không thấy sản phẩm đã nhập

-- Bước 1: Enable pg_trgm extension cho fuzzy search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Bước 2: Enable unaccent extension để không phân biệt dấu tiếng Việt
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Bước 3: Tạo function tìm kiếm không dấu
CREATE OR REPLACE FUNCTION unaccent_string(text)
RETURNS text AS $$
  SELECT unaccent($1);
$$ LANGUAGE sql IMMUTABLE;

-- Bước 4: Tạo index GIN cho tìm kiếm nhanh hơn (không dùng unaccent trong index)
CREATE INDEX IF NOT EXISTS idx_parts_name_trgm ON parts USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_parts_sku_trgm ON parts USING gin (sku gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_parts_category_trgm ON parts USING gin (category gin_trgm_ops);

-- Test search sau khi setup:
-- SELECT * FROM parts WHERE name ILIKE '%nap truoc%' OR name ILIKE '%nắp trước%';

-- Notes:
-- 1. pg_trgm giúp tìm kiếm gần đúng (fuzzy search)
-- 2. unaccent giúp tìm kiếm không phân biệt dấu: "nap" sẽ tìm thấy "nắp"
-- 3. GIN index giúp tăng tốc độ tìm kiếm đáng kể
-- 4. Sau khi chạy script này, cần cập nhật code search để sử dụng unaccent function
