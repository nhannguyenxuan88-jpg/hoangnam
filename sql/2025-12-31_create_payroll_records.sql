-- Create payroll_records table
CREATE TABLE IF NOT EXISTS public.payroll_records (
    id text NOT NULL PRIMARY KEY,
    employee_id text,
    employee_name text,
    month text, -- YYYY-MM
    base_salary numeric DEFAULT 0,
    allowances numeric DEFAULT 0,
    bonus numeric DEFAULT 0,
    deduction numeric DEFAULT 0,
    work_days numeric DEFAULT 0,
    standard_work_days numeric DEFAULT 26,
    social_insurance numeric DEFAULT 0,
    health_insurance numeric DEFAULT 0,
    unemployment_insurance numeric DEFAULT 0,
    personal_income_tax numeric DEFAULT 0,
    net_salary numeric DEFAULT 0,
    payment_status text DEFAULT 'pending', -- pending, paid
    payment_date timestamptz,
    payment_method text, -- cash, bank
    notes text,
    branch_id text DEFAULT 'main',
    created_at timestamptz DEFAULT timezone('utc'::text, now())
);

-- Enable RLS (Row Level Security) - consistent with other tables
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

-- Policy: Allow read/write access to authenticated users (simplify for now as per other tables seen in context)
CREATE POLICY "Enable all access for authenticated users" ON public.payroll_records
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_payroll_records_month ON public.payroll_records(month);
CREATE INDEX IF NOT EXISTS idx_payroll_records_employee_id ON public.payroll_records(employee_id);
