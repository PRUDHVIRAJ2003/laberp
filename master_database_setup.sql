-- ==============================================================================
-- JUST LAB ERP — COMPLETE MASTER PRODUCTION DATABASE SCHEMA (ALL-IN-ONE SQL)
-- ==============================================================================
-- Instructions:
-- Run this single SQL script in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- whenever you create a brand new Supabase project for a branch or deployment.
-- It creates all tables, columns, indexes, triggers, and sample branches from scratch!
-- ==============================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. LAB BRANCHES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.lab_branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT UNIQUE,
  address TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  phone TEXT,
  whatsapp_number TEXT,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  upi_id TEXT,
  payee_name TEXT,
  logo_url TEXT,
  lab_name TEXT DEFAULT 'Just LAB Diagnostic & Research Center',
  lab_tagline TEXT DEFAULT 'Precision Pathology & Molecular Diagnostics',
  invoice_note TEXT,
  signatory_name TEXT DEFAULT 'Dr. Authorized Signatory',
  signatory_designation TEXT DEFAULT 'Consulting Pathologist',
  signature_img TEXT,
  pathologist_name TEXT DEFAULT 'Dr. A. K. Sharma (MD Pathology)',
  pathologist_qualification TEXT DEFAULT 'Reg. No: MCI-445892',
  report_disclaimer TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure default columns exist if table was already created
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS upi_id TEXT;
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS payee_name TEXT;
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS lab_name TEXT DEFAULT 'Just LAB Diagnostic & Research Center';
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS lab_tagline TEXT DEFAULT 'Precision Pathology & Molecular Diagnostics';
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS invoice_note TEXT;
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS signatory_name TEXT DEFAULT 'Dr. Authorized Signatory';
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS signatory_designation TEXT DEFAULT 'Consulting Pathologist';
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS signature_img TEXT;
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS pathologist_name TEXT DEFAULT 'Dr. A. K. Sharma (MD Pathology)';
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS pathologist_qualification TEXT DEFAULT 'Reg. No: MCI-445892';
ALTER TABLE public.lab_branches ADD COLUMN IF NOT EXISTS report_disclaimer TEXT;

-- ==============================================================================
-- 2. PROFILES TABLE (USERS, PATIENTS & STAFF)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  phone_number TEXT,
  phone TEXT,
  role TEXT DEFAULT 'patient',
  branch_id UUID REFERENCES public.lab_branches(id) ON DELETE SET NULL,
  gender TEXT,
  age TEXT,
  height TEXT,
  weight TEXT,
  place TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Drop restrictive check constraints to allow any custom role
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_gender_check;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'patient';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.lab_branches(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS age TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS place TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;

-- ==============================================================================
-- 3. DIAGNOSTIC TEST GROUPS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.test_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT,
  description TEXT,
  price NUMERIC DEFAULT 500,
  turnaround_time TEXT DEFAULT '24 Hours',
  department TEXT DEFAULT 'Pathology',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. DIAGNOSTIC TESTS & PARAMETERS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.tests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  code TEXT,
  department TEXT DEFAULT 'Pathology',
  price NUMERIC DEFAULT 300,
  turnaround_time TEXT DEFAULT '12 Hours',
  specimen_type TEXT DEFAULT 'Blood (EDTA)',
  group_id UUID REFERENCES public.test_groups(id) ON DELETE SET NULL,
  parameters JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. REPORTS / APPOINTMENTS & BILLING INVOICES TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_number TEXT,
  invoice_number TEXT,
  patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  test_id UUID REFERENCES public.tests(id) ON DELETE SET NULL,
  group_id UUID REFERENCES public.test_groups(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.lab_branches(id) ON DELETE SET NULL,
  status TEXT DEFAULT 'completed',
  payment_status TEXT DEFAULT 'paid',
  sample_status TEXT DEFAULT 'collected',
  barcode TEXT,
  collection_type TEXT DEFAULT 'walkin',
  home_address TEXT,
  home_landmark TEXT,
  referring_doctor TEXT DEFAULT 'Self / General',
  results_data JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  authorized_signature TEXT,
  signed_by TEXT,
  signed_at TIMESTAMPTZ,
  specimen_name TEXT DEFAULT 'Whole Blood (EDTA)',
  sample_type TEXT DEFAULT 'Routine Blood / Serum',
  standard_price NUMERIC DEFAULT 0,
  discount_amount NUMERIC DEFAULT 0,
  net_amount NUMERIC DEFAULT 0,
  contract_name TEXT DEFAULT 'Standard Patient Rate',
  sample_collected_at TIMESTAMPTZ DEFAULT NOW(),
  sample_received_at TIMESTAMPTZ DEFAULT NOW(),
  report_approved_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS report_number TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS referring_doctor TEXT DEFAULT 'Self / General';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS results_data JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS authorized_signature TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS signed_by TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS specimen_name TEXT DEFAULT 'Whole Blood (EDTA)';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS sample_type TEXT DEFAULT 'Routine Blood / Serum';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS standard_price NUMERIC DEFAULT 0;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS net_amount NUMERIC DEFAULT 0;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS contract_name TEXT DEFAULT 'Standard Patient Rate';
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS beneficiary_name TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS beneficiary_age TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS beneficiary_gender TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS beneficiary_relationship TEXT DEFAULT 'Self';

-- Relax status check constraints
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_sample_status_check;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_payment_status_check;

-- ==============================================================================
-- 6. SAFE HANDLE_NEW_USER TRIGGER (CRASH-PROOF FOR USER SIGNUP)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
  v_full_name text;
  v_branch_id uuid;
BEGIN
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'patient');
  
  v_full_name := COALESCE(
    new.raw_user_meta_data->>'full_name',
    NULLIF(TRIM(CONCAT_WS(' ', new.raw_user_meta_data->>'first_name', new.raw_user_meta_data->>'last_name')), ''),
    split_part(new.email, '@', 1),
    'User'
  );

  BEGIN
    IF new.raw_user_meta_data->>'branch_id' IS NOT NULL AND TRIM(new.raw_user_meta_data->>'branch_id') != '' THEN
      v_branch_id := (new.raw_user_meta_data->>'branch_id')::uuid;
    ELSE
      v_branch_id := NULL;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_branch_id := NULL;
  END;

  BEGIN
    INSERT INTO public.profiles (
      id, email, full_name, role, branch_id, created_at
    )
    VALUES (
      new.id, new.email, v_full_name, v_role, v_branch_id, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      branch_id = EXCLUDED.branch_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user profile insert warning: %', SQLERRM;
  END;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ==============================================================================
-- 7. INSERT DEFAULT MAIN LAB BRANCH (INITIAL SEED)
-- ==============================================================================
INSERT INTO public.lab_branches (id, name, code, address, contact_phone, is_default, is_active)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Main Diagnostic Hub & Research Center',
  'MAIN',
  'Medical District Sector 5, India',
  '+91 98765 43210',
  true,
  true
)
ON CONFLICT DO NOTHING;

-- ==============================================================================
-- 8. GRANT PERMISSIONS
-- ==============================================================================
GRANT ALL ON public.lab_branches TO authenticated, service_role, anon;
GRANT ALL ON public.profiles TO authenticated, service_role, anon;
GRANT ALL ON public.test_groups TO authenticated, service_role, anon;
GRANT ALL ON public.tests TO authenticated, service_role, anon;
GRANT ALL ON public.reports TO authenticated, service_role, anon;

-- ==============================================================================
-- DONE! COMPLETE MASTER DATABASE SCHEMA APPLIED SUCCESSFULLY.
-- ==============================================================================
