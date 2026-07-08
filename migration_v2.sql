-- ============================================================
-- LAB ERP — Migration V2: Patient Extended Fields + Report Status
-- ============================================================
-- Run this in Supabase SQL Editor AFTER the initial schema.
-- This is safe to run multiple times (uses IF NOT EXISTS).
-- ============================================================

-- Add extended patient fields to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS height TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS weight TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS place TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS address TEXT;

-- Add sample collection tracking to reports
ALTER TABLE public.reports ADD COLUMN IF NOT EXISTS sample_status TEXT 
  CHECK (sample_status IN ('pending', 'collected', 'processing', 'completed')) 
  DEFAULT 'pending';

-- Update the handle_new_user trigger to include new fields
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id, 
    role,
    first_name,
    last_name,
    full_name,
    gender,
    age,
    email,
    phone_number,
    height,
    weight,
    place,
    address,
    branch_id
  )
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'role', 'patient'),
    new.raw_user_meta_data->>'first_name',
    new.raw_user_meta_data->>'last_name',
    COALESCE(new.raw_user_meta_data->>'full_name', CONCAT(new.raw_user_meta_data->>'first_name', ' ', new.raw_user_meta_data->>'last_name')),
    new.raw_user_meta_data->>'gender',
    (new.raw_user_meta_data->>'age')::integer,
    COALESCE(new.email, new.raw_user_meta_data->>'email'),
    COALESCE(new.phone, new.raw_user_meta_data->>'phone_number'),
    new.raw_user_meta_data->>'height',
    new.raw_user_meta_data->>'weight',
    new.raw_user_meta_data->>'place',
    new.raw_user_meta_data->>'address',
    (new.raw_user_meta_data->>'branch_id')::uuid
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
