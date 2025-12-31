-- Fix payment status for Truong Van Cuong
-- Based on user report: Employee "Trương Văn Cuông" has actually been paid 11,000,000 VND
-- but the payroll record still says "pending".

UPDATE public.payroll_records
SET 
  payment_status = 'paid',
  payment_date = NOW(), -- or specific date if known
  payment_method = 'cash', -- Assumed based on the screenshot showing "Chi" (Expense) with Cash
  net_salary = 11000000 -- Ensure amount matches if needed (though logic usually handles this, just safe keeping)
WHERE 
  employee_name LIKE '%Trương Văn Cuông%' 
  AND month = '2025-12'
  AND payment_status = 'pending';
