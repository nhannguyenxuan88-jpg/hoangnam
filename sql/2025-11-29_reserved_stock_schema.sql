-- Migration: Add reservedStock column to parts table for "deduct on payment" system
-- reservedStock tracks quantities that are reserved by pending work orders but not yet deducted

-- Add reservedStock column (JSONB per branch, same format as stock)
ALTER TABLE public.parts 
ADD COLUMN IF NOT EXISTS reservedStock JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.parts.reservedStock IS 'Số lượng đã đặt trước cho các phiếu sửa chữa chưa thanh toán. Format: {"branch_id": quantity}';

-- Helper function: Get available stock (actual stock - reserved)
CREATE OR REPLACE FUNCTION public.mc_available_stock(
  p_part_id TEXT,
  p_branch_id TEXT
) RETURNS INT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_stock INT;
  v_reserved INT;
BEGIN
  SELECT 
    COALESCE((stock->>p_branch_id)::int, 0),
    COALESCE((reservedStock->>p_branch_id)::int, 0)
  INTO v_stock, v_reserved
  FROM parts
  WHERE id = p_part_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  RETURN GREATEST(0, v_stock - v_reserved);
END;
$$;

COMMENT ON FUNCTION public.mc_available_stock IS 'Tính tồn kho khả dụng = tồn kho thực - đã đặt trước';

-- Helper function: Reserve stock for a part
CREATE OR REPLACE FUNCTION public.mc_reserve_stock(
  p_part_id TEXT,
  p_branch_id TEXT,
  p_quantity INT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_reserved INT;
BEGIN
  SELECT COALESCE((reservedStock->>p_branch_id)::int, 0) 
  INTO v_current_reserved
  FROM parts 
  WHERE id = p_part_id FOR UPDATE;

  UPDATE parts
  SET reservedStock = jsonb_set(
    COALESCE(reservedStock, '{}'::jsonb),
    ARRAY[p_branch_id],
    to_jsonb(v_current_reserved + p_quantity),
    true
  )
  WHERE id = p_part_id;
END;
$$;

-- Helper function: Release reserved stock
CREATE OR REPLACE FUNCTION public.mc_release_reserved_stock(
  p_part_id TEXT,
  p_branch_id TEXT,
  p_quantity INT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_reserved INT;
BEGIN
  SELECT COALESCE((reservedStock->>p_branch_id)::int, 0) 
  INTO v_current_reserved
  FROM parts 
  WHERE id = p_part_id FOR UPDATE;

  UPDATE parts
  SET reservedStock = jsonb_set(
    COALESCE(reservedStock, '{}'::jsonb),
    ARRAY[p_branch_id],
    to_jsonb(GREATEST(0, v_current_reserved - p_quantity)),
    true
  )
  WHERE id = p_part_id;
END;
$$;

-- View: Available stock summary per branch
CREATE OR REPLACE VIEW public.parts_available_stock AS
SELECT 
  p.id,
  p.name,
  p.sku,
  p.category,
  p.stock,
  p.reservedStock,
  -- Calculate available for each branch in stock
  (
    SELECT jsonb_object_agg(
      key,
      GREATEST(0, COALESCE((p.stock->>key)::int, 0) - COALESCE((p.reservedStock->>key)::int, 0))
    )
    FROM jsonb_object_keys(COALESCE(p.stock, '{}'::jsonb)) AS key
  ) AS availableStock
FROM parts p;

COMMENT ON VIEW public.parts_available_stock IS 'Hiển thị tồn kho thực, đã đặt trước và khả dụng cho mỗi phụ tùng';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.mc_available_stock TO authenticated;
GRANT EXECUTE ON FUNCTION public.mc_reserve_stock TO authenticated;
GRANT EXECUTE ON FUNCTION public.mc_release_reserved_stock TO authenticated;
GRANT SELECT ON public.parts_available_stock TO authenticated;
