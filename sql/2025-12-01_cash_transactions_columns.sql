-- Migration: Add missing columns to cash_transactions table
-- Date: 2025-12-01
-- Description: Add type, notes, and related columns for proper transaction tracking

-- Add type column (income/expense)
ALTER TABLE public.cash_transactions 
ADD COLUMN IF NOT EXISTS type TEXT;

-- Add notes column (separate from description for UI purposes)  
ALTER TABLE public.cash_transactions
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add recipient column (human readable target)
ALTER TABLE public.cash_transactions
ADD COLUMN IF NOT EXISTS recipient TEXT;

-- Add foreign key reference columns
ALTER TABLE public.cash_transactions
ADD COLUMN IF NOT EXISTS saleId TEXT;

ALTER TABLE public.cash_transactions
ADD COLUMN IF NOT EXISTS workOrderId TEXT;

ALTER TABLE public.cash_transactions
ADD COLUMN IF NOT EXISTS payrollRecordId TEXT;

ALTER TABLE public.cash_transactions
ADD COLUMN IF NOT EXISTS loanPaymentId TEXT;

ALTER TABLE public.cash_transactions
ADD COLUMN IF NOT EXISTS supplierId TEXT;

ALTER TABLE public.cash_transactions
ADD COLUMN IF NOT EXISTS customerId TEXT;

-- Update existing records: set type based on category
UPDATE public.cash_transactions 
SET type = CASE 
  WHEN category IN ('sale_income', 'service_income', 'other_income', 'debt_collection', 'general_income') THEN 'income'
  ELSE 'expense'
END
WHERE type IS NULL;

-- Create index on type for filtering
CREATE INDEX IF NOT EXISTS idx_cash_transactions_type ON public.cash_transactions(type);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_saleId ON public.cash_transactions(saleId);
CREATE INDEX IF NOT EXISTS idx_cash_transactions_workOrderId ON public.cash_transactions(workOrderId);

-- Migration completed successfully
