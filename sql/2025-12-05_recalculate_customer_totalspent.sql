-- ============================================================================
-- Tính lại totalSpent và visitCount cho tất cả khách hàng dựa trên work_orders
-- Chạy SQL này trong Supabase SQL Editor để fix khách hàng đang có totalSpent = 0
-- ============================================================================

-- Bước 1: Cập nhật totalSpent từ work_orders
UPDATE customers c
SET 
  totalspent = COALESCE(c.totalspent, 0) + COALESCE((
    SELECT SUM(w.total)
    FROM work_orders w
    WHERE w.customerphone = c.phone
      AND c.phone IS NOT NULL
      AND c.phone != ''
      AND w.total > 0
  ), 0)
WHERE c.phone IS NOT NULL AND c.phone != '';

-- Bước 2: Cập nhật visitCount từ work_orders (đếm số ngày có phiếu sửa)
UPDATE customers c
SET 
  visitcount = GREATEST(1, COALESCE((
    SELECT COUNT(DISTINCT DATE(w.creationdate))
    FROM work_orders w
    WHERE w.customerphone = c.phone
      AND c.phone IS NOT NULL
      AND c.phone != ''
  ), 0))
WHERE c.phone IS NOT NULL AND c.phone != '';

-- Bước 3: Cập nhật lastVisit từ phiếu sửa gần nhất
UPDATE customers c
SET 
  lastvisit = COALESCE((
    SELECT MAX(w.creationdate)
    FROM work_orders w
    WHERE w.customerphone = c.phone
      AND c.phone IS NOT NULL
      AND c.phone != ''
  ), c.lastvisit, c.created_at)
WHERE c.phone IS NOT NULL AND c.phone != '';

-- Kiểm tra kết quả
SELECT 
  name,
  phone,
  totalspent,
  visitcount,
  lastvisit
FROM customers
WHERE phone IS NOT NULL AND phone != ''
ORDER BY lastvisit DESC
LIMIT 20;
