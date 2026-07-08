-- ============================================================
-- LAB ERP — Migration V4: Specimens, Invoices & Contracts
-- ============================================================
-- Run this in your Supabase SQL Editor to enable:
-- 1. Specimen names and sample type tracking
-- 2. Official Tax Invoice IDs and Billing amounts
-- 3. Tester discount provisions and Net pricing
-- 4. Corporate contracts / Rate agreements & Payment status
-- Safe to run multiple times (uses IF NOT EXISTS).
-- ============================================================

-- 1. Add Specimen Name and Sample Type columns
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS specimen_name TEXT DEFAULT 'Whole Blood (EDTA)';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS sample_type TEXT DEFAULT 'Routine Blood / Serum';

-- 2. Add Invoice ID and Billing columns
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS standard_price NUMERIC DEFAULT 0;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS net_amount NUMERIC DEFAULT 0;

-- 3. Add Contracts & Payment Status columns
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS contract_name TEXT DEFAULT 'Standard Patient Rate';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid';

-- 4. Ensure payment_status constraint checks valid options
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_payment_status_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_payment_status_check 
  CHECK (payment_status IN ('unpaid', 'paid', 'partial', 'waived')) 
  NOT VALID;

-- 5. Grant permissions
GRANT ALL ON public.reports TO authenticated, service_role;
