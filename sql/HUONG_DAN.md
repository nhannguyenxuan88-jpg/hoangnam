# Hướng Dẫn Xóa Hóa Đơn - Giải Pháp Cuối Cùng

## Vấn đề
Không xóa được hóa đơn do RLS (Row Level Security) policies chặn function.

## Giải pháp

### Bước 1: Chạy SQL
Mở **Supabase SQL Editor** và chạy file:
```
sql/FINAL_SOLUTION.sql
```

File này sẽ:
- ✅ Tắt RLS tạm thời
- ✅ Tạo function atomic đơn giản không bị RLS chặn
- ✅ Hoàn kho + xóa cash transaction + xóa sale

### Bước 2: Test ngay
Sau khi chạy xong, test luôn:
```sql
SELECT sale_delete_atomic('sale-1704496977685');
```

**Kết quả mong đợi:** `{"success": true, "message": "Đã xóa thành công"}`

### Bước 3: Kiểm tra
```sql
SELECT * FROM sales WHERE id = 'sale-1704496977685';
```

**Kết quả mong đợi:** Empty (không còn sale nào)

### Bước 4: Test trên UI
- Hard refresh (Ctrl+Shift+R)
- Mở modal "Lịch sử bán hàng"
- Thử xóa 1 hóa đơn bất kỳ
- Reload trang → hóa đơn đã biến mất

## Sau khi test OK
Nếu muốn bật lại RLS (bảo mật hơn):
```sql
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;

-- Thêm policy cho owner/manager
CREATE POLICY "owners_can_manage_sales" ON sales
FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id = auth.uid() 
    AND profiles.role IN ('owner', 'manager')
  )
);
```

## Tóm tắt
1. Chạy `FINAL_SOLUTION.sql`
2. Test: `SELECT sale_delete_atomic('sale-1704496977685');`
3. Refresh UI và test xóa
4. Done! ✅
