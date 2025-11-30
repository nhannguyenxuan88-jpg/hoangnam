-- Fix ALL notification triggers - correct column names to match actual schema
-- Date: 2025-11-29
-- Issue: Triggers using wrong column names (snake_case vs camelCase)

-- =====================================================
-- FIX 1: SALES NOTIFICATION TRIGGER
-- sales table uses: sale_code, paymentMethod, branchId, userId (not code, payment_method, branch_id, created_by)
-- =====================================================

CREATE OR REPLACE FUNCTION notify_new_sale()
RETURNS TRIGGER AS $$
DECLARE
  item_count INTEGER;
BEGIN
  -- Count items in sale
  item_count := COALESCE(jsonb_array_length(NEW.items), 0);
  
  PERFORM create_notification(
    'sale',
    '🛒 Bán hàng mới',
    FORMAT('Đơn %s - %s (%s sản phẩm)', 
      COALESCE(NEW.sale_code, 'N/A'),
      TO_CHAR(COALESCE(NEW.total, 0), 'FM999,999,999') || 'đ',
      item_count
    ),
    jsonb_build_object(
      'sale_id', NEW.id,
      'code', NEW.sale_code,
      'total', NEW.total,
      'item_count', item_count,
      'payment_method', NEW."paymentMethod",
      'customer_name', NEW.customer->>'name'
    ),
    'owner',
    NEW."branchId",
    NULL  -- sales doesn't have created_by, userId is TEXT not UUID
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_new_sale ON sales;
CREATE TRIGGER trigger_notify_new_sale
AFTER INSERT ON sales
FOR EACH ROW EXECUTE FUNCTION notify_new_sale();

-- =====================================================
-- FIX 2: WORK ORDER NOTIFICATION TRIGGERS  
-- work_orders uses: vehicleModel, licensePlate, branchId (not vehicle_brand, license_plate, branch_id)
-- work_orders doesn't have created_by or updated_by
-- =====================================================

CREATE OR REPLACE FUNCTION notify_new_work_order()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_notification(
    'work_order',
    '🔧 Phiếu sửa chữa mới',
    FORMAT('Phiếu %s - %s %s đã được tạo', 
      LEFT(NEW.id, 8),  -- work_orders doesn't have code column, use first 8 chars of ID
      COALESCE(NEW."vehicleModel", ''),
      COALESCE(NEW."licensePlate", '')
    ),
    jsonb_build_object(
      'work_order_id', NEW.id,
      'status', NEW.status,
      'vehicle', COALESCE(NEW."vehicleModel", '') || ' ' || COALESCE(NEW."licensePlate", ''),
      'total', COALESCE(NEW.total, 0)
    ),
    'owner',
    NEW."branchId",
    NULL  -- work_orders doesn't have created_by
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the insert if notification fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_new_work_order ON work_orders;
CREATE TRIGGER trigger_notify_new_work_order
AFTER INSERT ON work_orders
FOR EACH ROW EXECUTE FUNCTION notify_new_work_order();

CREATE OR REPLACE FUNCTION notify_work_order_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if status actually changed
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    PERFORM create_notification(
      'work_order',
      CASE NEW.status
        WHEN 'Đang sửa' THEN '🛠️ Đang xử lý phiếu'
        WHEN 'Chờ phụ tùng' THEN '⏳ Chờ phụ tùng'
        WHEN 'Đã sửa xong' THEN '✅ Hoàn thành phiếu'
        WHEN 'Trả máy' THEN '🏍️ Đã giao xe'
        WHEN 'Đã hủy' THEN '❌ Phiếu đã hủy'
        ELSE '📋 Cập nhật phiếu'
      END,
      FORMAT('Phiếu %s: %s → %s', 
        LEFT(NEW.id, 8),  -- work_orders doesn't have code column
        COALESCE(OLD.status, 'Mới'),
        NEW.status
      ),
      jsonb_build_object(
        'work_order_id', NEW.id,
        'old_status', OLD.status,
        'new_status', NEW.status,
        'total', COALESCE(NEW.total, 0)
      ),
      'owner',
      NEW."branchId",
      NULL  -- work_orders doesn't have updated_by
    );
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the update if notification fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_work_order_status ON work_orders;
CREATE TRIGGER trigger_notify_work_order_status
AFTER UPDATE ON work_orders
FOR EACH ROW EXECUTE FUNCTION notify_work_order_status_change();

-- =====================================================
-- FIX 3: INVENTORY NOTIFICATION TRIGGERS
-- inventory_transactions uses: partId, partName, branchId, totalPrice (not part_id, branch_id, total_cost)
-- inventory_transactions doesn't have supplier_id or created_by
-- =====================================================

CREATE OR REPLACE FUNCTION notify_inventory_receipt()
RETURNS TRIGGER AS $$
DECLARE
  part_name TEXT;
BEGIN
  -- Only notify for stock-in transactions
  IF NEW.type NOT IN ('Nhập kho', 'Nhập hàng', 'Điều chỉnh tăng', 'Chuyển kho đến', 'Khởi tạo') THEN
    RETURN NEW;
  END IF;

  -- Use partName from the transaction itself
  part_name := NEW."partName";

  PERFORM create_notification(
    'inventory',
    CASE NEW.type
      WHEN 'Nhập kho' THEN '📦 Nhập kho mới'
      WHEN 'Nhập hàng' THEN '📦 Nhận hàng từ NCC'
      WHEN 'Chuyển kho đến' THEN '🔄 Chuyển kho đến'
      WHEN 'Khởi tạo' THEN '📦 Khởi tạo tồn kho'
      ELSE '📦 Điều chỉnh tăng'
    END,
    FORMAT('+%s %s - %s', 
      NEW.quantity, 
      COALESCE(part_name, 'Sản phẩm'),
      TO_CHAR(COALESCE(NEW."totalPrice", 0), 'FM999,999,999') || 'đ'
    ),
    jsonb_build_object(
      'transaction_id', NEW.id,
      'part_id', NEW."partId",
      'part_name', part_name,
      'quantity', NEW.quantity,
      'total_cost', NEW."totalPrice",
      'type', NEW.type
    ),
    'owner',
    NEW."branchId",
    NULL  -- inventory_transactions doesn't have created_by
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_inventory_receipt ON inventory_transactions;
CREATE TRIGGER trigger_notify_inventory_receipt
AFTER INSERT ON inventory_transactions
FOR EACH ROW EXECUTE FUNCTION notify_inventory_receipt();

CREATE OR REPLACE FUNCTION notify_low_stock()
RETURNS TRIGGER AS $$
DECLARE
  part_record RECORD;
  current_stock INTEGER;
  min_stock INTEGER := 5;  -- Default warning threshold
BEGIN
  -- Only check for stock-out transactions
  IF NEW.type NOT IN ('Xuất kho', 'Bán hàng', 'Sửa chữa', 'Điều chỉnh giảm', 'Chuyển kho đi') THEN
    RETURN NEW;
  END IF;

  -- Get part info with current stock (parts table doesn't have min_stock column)
  SELECT 
    p.id,
    p.name,
    COALESCE((p.stock->>NEW."branchId")::integer, 0) as branch_stock
  INTO part_record
  FROM parts p 
  WHERE p.id = NEW."partId";
  
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  current_stock := part_record.branch_stock;

  -- If stock is below minimum threshold (default 5)
  IF current_stock <= min_stock AND current_stock >= 0 THEN
    PERFORM create_notification(
      'inventory_warning',
      '⚠️ Tồn kho thấp',
      FORMAT('%s chỉ còn %s (cảnh báo: %s)', 
        part_record.name, 
        current_stock,
        min_stock
      ),
      jsonb_build_object(
        'part_id', NEW."partId",
        'part_name', part_record.name,
        'current_stock', current_stock,
        'min_stock', min_stock,
        'branch_id', NEW."branchId"
      ),
      'owner',
      NEW."branchId",
      NULL  -- inventory_transactions doesn't have created_by
    );
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the transaction if notification fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_low_stock ON inventory_transactions;
CREATE TRIGGER trigger_notify_low_stock
AFTER INSERT ON inventory_transactions
FOR EACH ROW EXECUTE FUNCTION notify_low_stock();

-- =====================================================
-- FIX 4: CASH TRANSACTION NOTIFICATION TRIGGER
-- cash_transactions uses: category (as type), description (not notes), branchId, paymentSource
-- cash_transactions doesn't have 'type' column, 'recipient', or 'created_by'
-- =====================================================

CREATE OR REPLACE FUNCTION notify_large_cash_transaction()
RETURNS TRIGGER AS $$
DECLARE
  tx_type TEXT;
BEGIN
  -- Only notify for large transactions (> 10 million VND)
  IF NEW.amount < 10000000 THEN
    RETURN NEW;
  END IF;

  -- Determine if income or expense based on category
  tx_type := CASE 
    WHEN NEW.category IN ('sale_income', 'service_income', 'other_income', 'debt_collection') THEN 'income'
    ELSE 'expense'
  END;

  PERFORM create_notification(
    'cash',
    CASE tx_type
      WHEN 'income' THEN '💵 Thu tiền lớn'
      ELSE '💸 Chi tiền lớn'
    END,
    FORMAT('%s %s - %s', 
      CASE tx_type WHEN 'income' THEN 'Thu' ELSE 'Chi' END,
      TO_CHAR(NEW.amount, 'FM999,999,999') || 'đ',
      COALESCE(NEW.description, NEW.category)
    ),
    jsonb_build_object(
      'transaction_id', NEW.id,
      'type', tx_type,
      'amount', NEW.amount,
      'category', NEW.category,
      'description', NEW.description,
      'payment_source', NEW."paymentSource"
    ),
    'owner',
    NEW."branchId",
    NULL  -- cash_transactions doesn't have created_by
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_large_cash ON cash_transactions;
CREATE TRIGGER trigger_notify_large_cash
AFTER INSERT ON cash_transactions
FOR EACH ROW EXECUTE FUNCTION notify_large_cash_transaction();

-- =====================================================
-- SUMMARY OF FIXES:
-- 1. sales: code → sale_code, payment_method → paymentMethod, branch_id → branchId
-- 2. work_orders: vehicle_brand → vehicleModel, license_plate → licensePlate, branch_id → branchId
-- 3. inventory_transactions: part_id → partId, total_cost → totalPrice, branch_id → branchId
-- 4. cash_transactions: type → category-based, notes → description, branch_id → branchId
-- 5. Removed all created_by/updated_by references (tables don't have these columns)
-- =====================================================
