-- ============================================================
-- LAB ERP — Fix RLS Infinite Recursion on profiles table
-- ============================================================
-- The profiles RLS policies reference the profiles table itself
-- to check the user's role, causing infinite recursion (500 error).
-- Fix: Use a SECURITY DEFINER function that bypasses RLS.
-- ============================================================

-- Step 1: Create a helper function that bypasses RLS to get role
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Step 2: Drop the old broken policies on profiles
DROP POLICY IF EXISTS "Admins and Super Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Super Admins can manage all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Step 3: Recreate policies using the helper function (no recursion!)
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Admins and Super Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.get_my_role() IN ('admin', 'super_admin'));

CREATE POLICY "Super Admins can manage all profiles"
  ON public.profiles FOR ALL
  USING (public.get_my_role() = 'super_admin');

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Step 4: Also fix any other tables that reference profiles for role checks
DROP POLICY IF EXISTS "Only super admins can modify branches" ON public.lab_branches;
CREATE POLICY "Only super admins can modify branches"
  ON public.lab_branches FOR ALL
  USING (public.get_my_role() = 'super_admin');

DROP POLICY IF EXISTS "Admins and Super Admins can modify tests" ON public.tests;
CREATE POLICY "Admins and Super Admins can modify tests"
  ON public.tests FOR ALL
  USING (public.get_my_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "Admins and Super Admins can modify test groups" ON public.test_groups;
CREATE POLICY "Admins and Super Admins can modify test groups"
  ON public.test_groups FOR ALL
  USING (public.get_my_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "Admins and Super Admins can modify mappings" ON public.test_group_mapping;
CREATE POLICY "Admins and Super Admins can modify mappings"
  ON public.test_group_mapping FOR ALL
  USING (public.get_my_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "Admins and Super Admins can manage all reports" ON public.reports;
CREATE POLICY "Admins and Super Admins can manage all reports"
  ON public.reports FOR ALL
  USING (public.get_my_role() IN ('admin', 'super_admin'));

DROP POLICY IF EXISTS "Admins and Super Admins can manage all results" ON public.report_results;
CREATE POLICY "Admins and Super Admins can manage all results"
  ON public.report_results FOR ALL
  USING (public.get_my_role() IN ('admin', 'super_admin'));

-- Done! The 500 error should be gone now.
