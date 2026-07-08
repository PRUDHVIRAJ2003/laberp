-- ==============================================================================
-- LAB REPORTING APP — MIGRATION V7: FAMILY DEPENDENTS & BENEFICIARY SUPPORT
-- ==============================================================================
-- Allows users (relatives, parents, children) to book diagnostic reports for
-- family members or grandparents who don't have their own personal mobile number.
-- ==============================================================================

ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS beneficiary_name TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS beneficiary_age TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS beneficiary_gender TEXT;
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS beneficiary_relationship TEXT DEFAULT 'Self';

-- Allow admin & patient to store secondary contact or guardian info on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS guardian_phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
