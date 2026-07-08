-- ============================================================
-- LAB ERP — Migration V3: Comprehensive Reports & Results Engine
-- ============================================================
-- Run this in Supabase SQL Editor to enable full Report CRUD,
-- dynamic parameter tracking, digital signatures, and PDF data.
-- Safe to run multiple times (uses IF NOT EXISTS).
-- ============================================================

-- 1. Add test_id for individual test reports (in addition to group_id for panels)
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS test_id UUID REFERENCES public.tests(id) ON DELETE SET NULL;

-- 2. Add dynamic JSONB results storage (stores all observed parameters, ranges, and abnormality flags)
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS results_data JSONB DEFAULT '[]'::jsonb;

-- 3. Add digital signature & authorization tracking
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS authorized_signature TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS signed_by TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS signed_at TIMESTAMPTZ;

-- 4. Add clinical notes and formatted report number
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS report_number TEXT;

-- 5. Ensure sample_status includes all needed stages
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_sample_status_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_sample_status_check 
  CHECK (sample_status IN ('pending', 'collected', 'processing', 'completed', 'rejected')) 
  NOT VALID;

-- 6. Ensure report status includes completed and published
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports ADD CONSTRAINT reports_status_check 
  CHECK (status IN ('draft', 'processing', 'completed', 'published', 'cancelled')) 
  NOT VALID;

-- 7. Grant access to service role and authenticated users
GRANT ALL ON public.reports TO authenticated, service_role;
