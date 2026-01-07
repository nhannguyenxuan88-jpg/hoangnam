-- ============================================================================
-- TẠO BẢNG QUẢN LÝ KHUYẾN MÃI
-- ============================================================================
-- Date: 2026-01-07
-- Purpose: Tạo bảng để lưu thông tin khuyến mãi, cho phép admin tự quản lý
-- ============================================================================

-- Drop table if exists (để reset)
DROP TABLE IF EXISTS public.promotions CASCADE;

-- Tạo bảng promotions
CREATE TABLE public.promotions (
  id TEXT PRIMARY KEY DEFAULT ('PROMO-' || EXTRACT(EPOCH FROM NOW())::TEXT),
  title TEXT NOT NULL,
  description TEXT,
  discount_percent INTEGER,
  discount_amount NUMERIC(10, 2),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  image_url TEXT,
  products TEXT[], -- Danh sách sản phẩm áp dụng
  min_purchase NUMERIC(10, 2), -- Đơn tối thiểu
  is_active BOOLEAN DEFAULT TRUE,
  featured BOOLEAN DEFAULT FALSE, -- Hiển thị nổi bật
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  branch_id TEXT -- Để tương thích multi-branch trong tương lai
);

-- Index
CREATE INDEX idx_promotions_active ON public.promotions(is_active);
CREATE INDEX idx_promotions_dates ON public.promotions(start_date, end_date);
CREATE INDEX idx_promotions_featured ON public.promotions(featured, is_active);

-- Enable RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read active promotions (public)
CREATE POLICY "Anyone can view active promotions"
  ON public.promotions
  FOR SELECT
  USING (is_active = TRUE);

-- Policy: Only owner/manager can insert
CREATE POLICY "Owner/Manager can insert promotions"
  ON public.promotions
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

-- Policy: Only owner/manager can update
CREATE POLICY "Owner/Manager can update promotions"
  ON public.promotions
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role IN ('owner', 'manager')
    )
  );

-- Policy: Only owner can delete
CREATE POLICY "Owner can delete promotions"
  ON public.promotions
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'owner'
    )
  );

-- Function: Auto update updated_at
CREATE OR REPLACE FUNCTION update_promotions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger
CREATE TRIGGER trigger_update_promotions_updated_at
  BEFORE UPDATE ON public.promotions
  FOR EACH ROW
  EXECUTE FUNCTION update_promotions_updated_at();

-- Insert sample data (3 promotions hiện tại)
INSERT INTO public.promotions (
  id, title, description, discount_amount, start_date, end_date, 
  image_url, is_active, featured
) VALUES
(
  'promo-chen-co-honda',
  '🔧 Thay Chén Cổ Honda Chính Hãng',
  'Thay chén cổ Honda chính hãng, khắc phục: Lụp cụp, rung đầu, nặng lái. Giá trọn gói chỉ 200.000đ. So sánh cũ (rỉ sét) vs mới (chính hãng). Áp dụng cho: Winner, SH, AirBlade, Vision, Vario, Wave, Future, Dream...',
  0,
  '2026-01-07',
  '2026-12-31',
  '/images/promotions/thay-chen-co-honda.png',
  TRUE,
  TRUE
),
(
  'promo-maintenance-10',
  '⚡ Bảo Dưỡng Tiêu Chuẩn 10 Bước',
  'Gói bảo dưỡng tiêu chuẩn 10 bước: Vệ sinh nồi xe, nhông sên đĩa, kim phun xăng, kiểm tra điện/đèn/còi, hệ thống phanh, bơm vỏ xe, nước mát, lọc gió/bugi, phuộc trước/sau, bình acquy, và xịt dung dịch RP7. Xe số/côn tay: 150.000đ (giảm từ 250.000đ). Xe tay ga: 180.000đ (giảm từ 300.000đ).',
  100000,
  '2026-01-07',
  '2026-06-30',
  '/images/promotions/bao-duong-tieu-chuan-10-buoc.png',
  TRUE,
  TRUE
),
(
  'promo-maintenance-14',
  '⚡ Bảo Dưỡng Nâng Cao 14 Bước',
  'Gói bảo dưỡng toàn diện 14 bước: Vệ sinh nồi xe, hệ thống phanh, kiểm tra điện, lọc gió/bugi, nước mát, xịt dung dịch RP7, và nhiều hơn nữa. Xe số/côn tay: 430.000đ (giảm từ 800.000đ). Xe tay ga: 480.000đ (giảm từ 900.000đ).',
  370000,
  '2026-01-07',
  '2026-06-30',
  '/images/promotions/bao-duong-nang-cao-14-buoc.png',
  TRUE,
  TRUE
);

-- ============================================================================
-- HƯỚNG DẪN SỬ DỤNG
-- ============================================================================
-- 1. Chạy file SQL này trong Supabase SQL Editor
-- 2. Vào trang /admin/promotions để quản lý khuyến mãi
-- 3. Upload ảnh và điền thông tin
-- 4. Trang /promotions sẽ tự động lấy từ database
-- ============================================================================
