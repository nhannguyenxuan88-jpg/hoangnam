-- Fix notification triggers for work_orders
-- The triggers were using wrong column names (snake_case vs camelCase)

-- 4.1 New Work Order Created - FIXED
CREATE OR REPLACE FUNCTION notify_new_work_order()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_notification(
    'work_order',
    '🔧 Phiếu sửa chữa mới',
    FORMAT('Phiếu %s - %s %s đã được tạo', 
      LEFT(NEW.id, 8),  -- Use first 8 chars of ID instead of code
      COALESCE(NEW.vehicleModel, ''),
      COALESCE(NEW.licensePlate, '')
    ),
    jsonb_build_object(
      'work_order_id', NEW.id,
      'status', NEW.status,
      'vehicle', COALESCE(NEW.vehicleModel, '') || ' ' || COALESCE(NEW.licensePlate, ''),
      'total', COALESCE(NEW.total, 0)
    ),
    'owner',
    NEW.branchId,
    NULL  -- No created_by column
  );
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the insert if notification fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.2 Work Order Status Changed - FIXED
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
        LEFT(NEW.id, 8),
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
      NEW.branchId,
      NULL
    );
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Don't fail the update if notification fails
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate triggers
DROP TRIGGER IF EXISTS trigger_notify_new_work_order ON work_orders;
CREATE TRIGGER trigger_notify_new_work_order
AFTER INSERT ON work_orders
FOR EACH ROW EXECUTE FUNCTION notify_new_work_order();

DROP TRIGGER IF EXISTS trigger_notify_work_order_status ON work_orders;
CREATE TRIGGER trigger_notify_work_order_status
AFTER UPDATE ON work_orders
FOR EACH ROW EXECUTE FUNCTION notify_work_order_status_change();
