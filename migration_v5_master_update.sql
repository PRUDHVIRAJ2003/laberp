-- ==============================================================================
-- LAB ERP — MASTER SUPABASE MIGRATION (V5 All-in-One Consolidation)
-- ==============================================================================
-- Instructions:
-- Copy and paste this script into your Supabase SQL Editor and click "Run".
-- It uses "IF NOT EXISTS" and safe alterations, so you can run it multiple times
-- without errors or data loss. It ensures all recent features are 100% enabled!
-- ==============================================================================

-- 1. EXTENDED PATIENT PROFILE FIELDS
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS place TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.lab_branches(id) ON DELETE SET NULL;

-- 2. LAB BRANCHES EXTENSIONS (FOR MULTI-BRANCH WHATSAPP)
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 3. REPORT REFERENCE NUMBERS & DIAGNOSTIC MEASUREMENT RESULTS
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS report_number TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS test_id UUID REFERENCES public.tests(id) ON DELETE SET NULL;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS referring_doctor TEXT DEFAULT 'Self / General';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS results_data JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. DIGITAL SIGNATURES & AUTHORIZATION
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS authorized_signature TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS signed_by TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

-- 5. SPECIMENS, INVOICES, RATE CONTRACTS & BILLING
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS specimen_name TEXT DEFAULT 'Whole Blood (EDTA)';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS sample_type TEXT DEFAULT 'Routine Blood / Serum';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS standard_price NUMERIC DEFAULT 0;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS net_amount NUMERIC DEFAULT 0;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS contract_name TEXT DEFAULT 'Standard Patient Rate';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'paid';

-- 6. STATUS CHECK CONSTRAINTS (RELAXED & EXPANDED)
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_sample_status_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_sample_status_check 
  CHECK (sample_status IN ('pending', 'collected', 'processing', 'completed', 'rejected')) 
  NOT VALID;

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_status_check 
  CHECK (status IN ('draft', 'processing', 'completed', 'published', 'cancelled')) 
  NOT VALID;

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_payment_status_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_payment_status_check 
  CHECK (payment_status IN ('unpaid', 'paid', 'partial', 'waived')) 
  NOT VALID;

-- 7. UPDATE TRIGGER FOR NEW USER REGISTRATIONS
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, role, first_name, last_name, full_name, gender, age, email, phone_number, height, weight, place, address, branch_id
  )
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'role', 'patient'),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    COALESCE(new.raw_user_meta_data->>'full_name', CONCAT(new.raw_user_meta_data->>'first_name', ' ', new.raw_user_meta_data->>'last_name')),
    new.raw_user_meta_data->>'gender',
    new.raw_user_meta_data->>'age',
    new.email,
    new.raw_user_meta_data->>'phone_number',
    new.raw_user_meta_data->>'height',
    new.raw_user_meta_data->>'weight',
    new.raw_user_meta_data->>'place',
    new.raw_user_meta_data->>'address',
    (new.raw_user_meta_data->>'branch_id')::uuid
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. GRANT ALL PERMISSIONS TO SERVICE ROLE AND AUTHENTICATED USERS
GRANT ALL ON public.profiles TO authenticated, service_role;
GRANT ALL ON public.lab_branches TO authenticated, service_role;
GRANT ALL ON public.tests TO authenticated, service_role;
GRANT ALL ON public.test_groups TO authenticated, service_role;
GRANT ALL ON public.reports TO authenticated, service_role;

-- ==============================================================================
-- MIGRATION V5 COMPLETE! YOUR DATABASE IS NOW 100% UP TO DATE.
-- ==============================================================================
