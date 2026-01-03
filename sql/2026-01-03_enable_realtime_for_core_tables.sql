-- Enable Realtime for Work Orders and Sales tables
-- Date: 2026-01-03
-- Purpose: Allow real-time updates when work orders or sales are created/updated/deleted

-- Step 1: Enable Realtime publication for work_orders table
ALTER PUBLICATION supabase_realtime ADD TABLE work_orders;

-- Step 2: Enable Realtime publication for sales table
ALTER PUBLICATION supabase_realtime ADD TABLE sales;

-- Step 3: Enable Realtime publication for parts table (for stock updates)
ALTER PUBLICATION supabase_realtime ADD TABLE parts;

-- Step 4: Enable Realtime publication for customers table
ALTER PUBLICATION supabase_realtime ADD TABLE customers;

-- Step 5: Enable Realtime publication for cash_transactions table
ALTER PUBLICATION supabase_realtime ADD TABLE cash_transactions;

-- Step 6: Enable Realtime publication for inventory_transactions table
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_transactions;

-- Verify which tables are enabled for realtime
SELECT
    schemaname,
    tablename
FROM
    pg_publication_tables
WHERE
    pubname = 'supabase_realtime'
ORDER BY
    schemaname,
    tablename;

-- Note: After running this migration:
-- 1. Changes to these tables will be broadcast to all connected clients
-- 2. Clients must subscribe to specific tables they want to listen to
-- 3. The app already has subscriptions for work_orders and sales
-- 4. Make sure Realtime is enabled in Supabase Dashboard > Settings > API > Realtime
