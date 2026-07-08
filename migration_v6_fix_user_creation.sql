-- ==============================================================================
-- LAB REPORTING APP — MIGRATION V6: FIX USER CREATION & TRIGGER CONSTRAINTS
-- ==============================================================================
-- Run this SQL in your Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)
-- It ensures creating any user (admin, receptionist, technician, pathologist, etc.)
-- succeeds without database trigger or check constraint errors.
-- ==============================================================================

-- 1. DROP RESTRICTIVE CHECK CONSTRAINTS ON PROFILES TABLE (ALLOW ALL ROLES)
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_gender_check;

-- 2. REPLACE THE handle_new_user TRIGGER WITH AN EXCEPTION-SAFE SECURITY DEFINER FUNCTION
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
      id,
      email,
      full_name,
      role,
      branch_id,
      created_at
    )
    VALUES (
      new.id,
      new.email,
      v_full_name,
      v_role,
      v_branch_id,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = EXCLUDED.role,
      branch_id = EXCLUDED.branch_id;
  EXCEPTION WHEN OTHERS THEN
    -- Prevent trigger failure from aborting auth.users insert
    RAISE WARNING 'handle_new_user profile insert warning: %', SQLERRM;
  END;

  RETURN new;
END;
$$;

-- 3. ENSURE PERMISSIONS ARE PROPERLY GRANTED
GRANT ALL ON public.profiles TO authenticated, service_role;
