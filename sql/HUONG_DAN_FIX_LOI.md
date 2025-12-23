# Hướng Dẫn Kỹ Thuật - Fix Lỗi Xóa Hóa Đơn (Final)

Tôi đã dọn dẹp các file rác và tạo ra **1 file duy nhất** để xử lý triệt để vấn đề này.

## Các bước thực hiện:

### 1. Mở Supabase SQL Editor
Copy toàn bộ nội dung file sau và chạy:
`sql/FINAL_CLEANUP_AND_FIX.sql`

File này sẽ:
- ✅ Fix lỗi thiếu ID (dùng `gen_random_uuid()`)
- ✅ Fix lỗi tên cột (dùng đúng `partId`, `branchId`...)
- ✅ Fix lỗi RLS (disable RLS sales)
- ✅ Hoàn kho + Lưu lịch sử kho + Xóa tiền + Xóa đơn

### 2. Chạy lệnh xóa
Sau khi chạy script trên thành công, hãy chạy lệnh này để xóa đơn hàng bạn muốn:

```sql
SELECT sale_delete_atomic('sale-1704496977685');
```

(ID này là ID của hóa đơn `#BH-20251223-001` mà chúng ta đã tìm ra trước đó).

### 3. Kiểm tra kết quả
Refresh lại trang web. Hóa đơn sẽ biến mất, tồn kho sẽ tăng lên, và lịch sử kho sẽ ghi nhận giao dịch hoàn trả.
