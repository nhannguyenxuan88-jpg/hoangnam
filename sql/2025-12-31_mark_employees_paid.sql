-- Update payment status for employees who have already been paid for 12/2025
UPDATE public.payroll_records
SET 
  payment_status = 'paid',
  payment_date = NOW()
WHERE 
  month = '2025-12' 
  AND employee_name IN (
    'Trương Văn Cuông',
    'Nguyễn Thanh Lộc',
    'Nguyễn Văn Tấn',
    'Võ Thanh Lâm'
  );

-- Verify the updates
SELECT employee_name, month, payment_status, net_salary 
FROM public.payroll_records 
WHERE month = '2025-12';
