-- =============================================
-- SCRIPT XÓA TOÀN BỘ DỮ LIỆU TEST
-- Ngày: 2025-11-19
-- Mục đích: Xóa sạch tất cả dữ liệu để test lại từ đầu
-- =============================================

-- Xóa dữ liệu theo thứ tự (từ bảng con đến bảng cha)
DELETE FROM cash_transactions;
DELETE FROM sales;
DELETE FROM work_orders;
DELETE FROM vehicles;
DELETE FROM customers;

-- Hiển thị kết quả
SELECT 
  'work_orders' as table_name, 
  COUNT(*) as remaining_records 
FROM work_orders
UNION ALL
SELECT 'sales', COUNT(*) FROM sales
UNION ALL
SELECT 'customers', COUNT(*) FROM customers
UNION ALL
SELECT 'vehicles', COUNT(*) FROM vehicles
UNION ALL
SELECT 'cash_transactions', COUNT(*) FROM cash_transactions
ORDER BY table_name;
