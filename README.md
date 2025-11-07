# MotoCarePro Standalone

Ứng dụng MotoCarePro đã được tách thành dự án độc lập, bỏ toàn bộ phần phân quyền / role / feature visibility.

## Mục tiêu
- Chỉ tập trung vào các màn hình chính (Dashboard, Bán hàng, Kho) ví dụ tối giản.
- Không còn kiểm tra roles, departments, hay chặn route.
- Dễ dàng mở rộng lại nếu sau này cần phân quyền.

## Cấu trúc
```
motocarepro-standalone/
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  src/
    main.tsx
    App.tsx
    supabaseClient.ts
    index.css
    types.ts
```

## Chạy dự án
```powershell
npm install
npm run dev
```
Mặc định chạy ở http://localhost:4310

## Build production
```powershell
npm run build
npm run preview
```

## Biến môi trường cần (tạo file `.env.local` nếu cần)
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```
Nếu bỏ trống sẽ chạy ở chế độ offline giả lập.

## Đã loại bỏ
- Toàn bộ logic chọn ứng dụng khác (PinCorp).
- Kiểm tra `allowedApps`, phân quyền theo phòng ban.
- Chặn route bằng `isAdmin`.
- FeatureVisibilityProvider.

## Mở rộng tiếp theo (gợi ý)
1. Thêm lại các màn hình đầy đủ từ dự án gốc (SalesManager, InventoryManager...).
2. Thêm context quản lý state chung (AppContext) để đồng bộ dữ liệu.
3. Tích hợp Supabase thật với truy vấn và caching React Query.
4. Bổ sung hệ thống phân quyền mới nếu cần (RBAC hoặc ABAC) trong thư mục `auth/` riêng.

## Ghi chú
Đây là skeleton tối giản để tách nhanh. Một số thành phần phức tạp chưa copy sang (ServiceManager, v.v.). Có thể sao chép dần từ dự án gốc và bỏ phần code liên quan đến phân quyền cũ.
