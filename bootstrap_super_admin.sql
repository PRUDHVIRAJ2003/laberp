-- ============================================================
-- LAB ERP — Bulletproof Super Admin Setup
-- ============================================================
-- Run this ONCE in your Supabase SQL Editor:
--   https://supabase.com/dashboard → Your Project → SQL Editor
-- ============================================================

-- STEP 1: Find your user ID (UUID)
SELECT id, email, phone FROM auth.users ORDER BY created_at DESC LIMIT 5;

-- STEP 2: Copy your UUID from above and replace 'YOUR-USER-UUID-HERE' below.
-- This query will INSERT your profile if it's missing, OR update it if it exists!
INSERT INTO public.profiles (id, email, role, full_name)
SELECT 
  id, 
  email, 
  'super_admin', 
  COALESCE(raw_user_meta_data->>'full_name', 'Super Admin')
FROM auth.users
WHERE id = 'YOUR-USER-UUID-HERE'
ON CONFLICT (id) DO UPDATE SET role = 'super_admin';

-- STEP 3: Verify your account now shows 'super_admin' role:
SELECT id, email, role, full_name FROM public.profiles WHERE role = 'super_admin';
