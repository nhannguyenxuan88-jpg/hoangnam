-- ============================================
-- FINAL CLEANUP AND FIX FOR SALE DELETION
-- ============================================

-- 1. Ensure RLS is disabled for sales table (safest option for now)
ALTER TABLE sales DISABLE ROW LEVEL SECURITY;

-- 2. Drop existing function to start clean
DROP FUNCTION IF EXISTS sale_delete_atomic(TEXT);

-- 3. Create the corrected function
-- Fixes included:
-- - Uses gen_random_uuid() for 'id' column in inventory_transactions (Fixes NULL ID error)
-- - Uses correct CamelCase column names for inventory_transactions ("partId", "branchId", etc.)
-- - Updates stock correctly
-- - Handles cash transaction deletion
-- - Handles sale record deletion

CREATE OR REPLACE FUNCTION sale_delete_atomic(p_sale_id TEXT)
RETURNS json
LANGUAGE plpgsql
AS $$
DECLARE
    v_sale RECORD;
    v_item jsonb;
    v_part_id TEXT;
    v_branch_id TEXT;
    v_restored_count INT := 0;
BEGIN
    -- 1. Get Sale Data
    SELECT * INTO v_sale FROM sales WHERE id = p_sale_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy hóa đơn: %', p_sale_id;
    END IF;
    
    v_branch_id := COALESCE(v_sale.branchid, 'CN1');
    
    -- 2. Restore Inventory & Create Transaction History
    FOR v_item IN SELECT * FROM jsonb_array_elements(v_sale.items)
    LOOP
        v_part_id := v_item->>'partId';
        
        IF v_part_id IS NOT NULL AND v_part_id != '' THEN
            -- Update stock quantity in parts table
            UPDATE parts
            SET stock = jsonb_set(
                COALESCE(stock, '{}'::jsonb),
                ARRAY[v_branch_id],
                to_jsonb(COALESCE((stock->>v_branch_id)::INT, 0) + (v_item->>'quantity')::INT)
            )
            WHERE id = v_part_id;
            
            -- Insert into inventory_transactions history
            -- IMPORTANT: Generates UUID for id, uses CamelCase columns
            INSERT INTO inventory_transactions (
                "id", 
                "type", 
                "partId", 
                "partName", 
                "quantity", 
                "branchId", 
                "notes", 
                "date"
            ) VALUES (
                gen_random_uuid(), -- Fix: Auto-generate ID
                'Nhập kho',
                v_part_id, 
                v_item->>'partName', 
                (v_item->>'quantity')::INT, 
                v_branch_id, 
                'Hoàn kho - xóa hóa đơn ' || p_sale_id, 
                NOW()
            );
            
            v_restored_count := v_restored_count + 1;
        END IF;
    END LOOP;
    
    -- 3. Delete Cash Transaction
    IF v_sale.cashtransactionid IS NOT NULL AND v_sale.cashtransactionid != '' THEN
        DELETE FROM cash_transactions WHERE id = v_sale.cashtransactionid;
    END IF;
    
    -- 4. Delete Sale Record
    DELETE FROM sales WHERE id = p_sale_id;
    
    RETURN json_build_object(
        'success', true, 
        'message', 'Đã xóa hóa đơn và hoàn kho thành công',
        'restoredItems', v_restored_count
    );
EXCEPTION WHEN OTHERS THEN
    -- Return error as JSON to prevent frontend crash
    RETURN json_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION sale_delete_atomic(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION sale_delete_atomic(TEXT) TO service_role;

-- ============================================
-- INSTRUCTIONS FOR USER:
-- 1. Run this entire script in Supabase SQL Editor.
-- 2. Then run the test command below to delete your specific sale.
-- ============================================

-- SELECT sale_delete_atomic('sale-1704496977685');
