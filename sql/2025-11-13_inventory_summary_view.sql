-- Create inventory summary view by branch
CREATE OR REPLACE VIEW inventory_summary_by_branch AS
SELECT 
  p.id as part_id,
  p.name as part_name,
  p.sku,
  b.id as branch_id,
  b.name as branch_name,
  COALESCE((p.stock->>b.id)::int, 0) as current_stock,
  COALESCE((p.retailPrice->>b.id)::numeric, 0) as retail_price,
  COALESCE((p.costPrice->>b.id)::numeric, 0) as cost_price,
  COALESCE((p.stock->>b.id)::int, 0) * COALESCE((p.costPrice->>b.id)::numeric, 0) as total_value
FROM parts p
CROSS JOIN (SELECT DISTINCT branch_id as id, branch_id as name FROM work_orders UNION SELECT 'CN1', 'CN1') b
WHERE p.stock ? b.id
ORDER BY b.id, p.name;

COMMENT ON VIEW inventory_summary_by_branch IS 'Tổng hợp tồn kho theo chi nhánh';

-- Grant access
GRANT SELECT ON inventory_summary_by_branch TO authenticated;
