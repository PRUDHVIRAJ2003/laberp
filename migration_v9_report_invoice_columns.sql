-- ============================================================
-- LAB ERP — Migration V9: Direct Standalone Invoice & Report Columns
-- ============================================================
-- Run this in your Supabase SQL Editor so reports and standalone
-- invoices can store direct patient and contact fields safely.
-- ============================================================

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS patient_name TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS patient_phone TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS patient_email TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS patient_age TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS patient_gender TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS test_name TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS report_number TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS specimen_name TEXT DEFAULT 'Whole Blood (EDTA)';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS sample_type TEXT DEFAULT 'Routine Serum';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS contract_name TEXT DEFAULT 'Standard Patient Rate';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS standard_price NUMERIC DEFAULT 0;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS net_amount NUMERIC DEFAULT 0;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid';

-- Grant permissions
GRANT ALL ON public.reports TO authenticated, service_role, anon;
