-- NOTE: Run these drops carefully if you already have data!
DROP TABLE IF EXISTS public.report_results CASCADE;
DROP TABLE IF EXISTS public.reports CASCADE;
DROP TABLE IF EXISTS public.test_group_mapping CASCADE;
DROP TABLE IF EXISTS public.test_groups CASCADE;
DROP TABLE IF EXISTS public.tests CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.lab_branches CASCADE;

-- ==========================================================
-- STEP 1: CREATE TABLES (In Dependency Order)
-- ==========================================================

-- 1. Lab Branches Table
CREATE TABLE public.lab_branches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  address TEXT,
  contact_phone TEXT,
  contact_email TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Profiles Table (Patients, Admins & Super Admins)
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('super_admin', 'admin', 'patient')) DEFAULT 'patient',
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  gender TEXT CHECK (gender IN ('Male', 'Female', 'Other')),
  age INTEGER,
  email TEXT,
  phone_number TEXT,
  branch_id UUID REFERENCES public.lab_branches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tests Table (Test Master - fully dynamic)
CREATE TABLE public.tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  shortcut TEXT,
  sample_type TEXT,
  price NUMERIC,
  precautions TEXT,
  components JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Test Groups Table (Group Test Manager - panels like CBC, LFT)
CREATE TABLE public.test_groups (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Test Group Mapping Table (Links individual tests to a group)
CREATE TABLE public.test_group_mapping (
  group_id UUID REFERENCES public.test_groups(id) ON DELETE CASCADE,
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, test_id)
);

-- 6. Reports Table (The final lab report for a patient)
CREATE TABLE public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES public.lab_branches(id) ON DELETE SET NULL,
  group_id UUID REFERENCES public.test_groups(id),
  referring_doctor TEXT,
  status TEXT CHECK (status IN ('draft', 'published')) DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Report Results Table (The observed values for a specific test in a report)
CREATE TABLE public.report_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  report_id UUID REFERENCES public.reports(id) ON DELETE CASCADE,
  test_id UUID REFERENCES public.tests(id) ON DELETE CASCADE,
  observed_value TEXT NOT NULL,
  remarks TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================
-- STEP 2: ENABLE ROW LEVEL SECURITY & CREATE POLICIES
-- ==========================================================

-- Create helper function to check role without RLS infinite recursion
CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

ALTER TABLE public.lab_branches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read active branches" ON public.lab_branches FOR SELECT USING (true);
CREATE POLICY "Only super admins can modify branches" ON public.lab_branches FOR ALL USING (
  public.get_my_role() = 'super_admin'
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and Super Admins can view all profiles" ON public.profiles FOR SELECT USING (
  public.get_my_role() IN ('admin', 'super_admin')
);
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Super Admins can manage all profiles" ON public.profiles FOR ALL USING (
  public.get_my_role() = 'super_admin'
);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

ALTER TABLE public.tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read tests" ON public.tests FOR SELECT USING (true);
CREATE POLICY "Admins and Super Admins can modify tests" ON public.tests FOR ALL USING (
  public.get_my_role() IN ('admin', 'super_admin')
);

ALTER TABLE public.test_groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read test groups" ON public.test_groups FOR SELECT USING (true);
CREATE POLICY "Admins and Super Admins can modify test groups" ON public.test_groups FOR ALL USING (
  public.get_my_role() IN ('admin', 'super_admin')
);

ALTER TABLE public.test_group_mapping ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read mappings" ON public.test_group_mapping FOR SELECT USING (true);
CREATE POLICY "Admins and Super Admins can modify mappings" ON public.test_group_mapping FOR ALL USING (
  public.get_my_role() IN ('admin', 'super_admin')
);

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and Super Admins can manage all reports" ON public.reports FOR ALL USING (
  public.get_my_role() IN ('admin', 'super_admin')
);
CREATE POLICY "Patients can view their own published reports" ON public.reports FOR SELECT USING (auth.uid() = patient_id AND status = 'published');

ALTER TABLE public.report_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins and Super Admins can manage all results" ON public.report_results FOR ALL USING (
  public.get_my_role() IN ('admin', 'super_admin')
);
CREATE POLICY "Patients can view results of their reports" ON public.report_results FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.reports WHERE reports.id = report_results.report_id AND reports.patient_id = auth.uid() AND reports.status = 'published')
);

-- ==========================================================
-- STEP 3: AUTH TRIGGER & SEED DATA
-- ==========================================================

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
    (new.raw_user_meta_data->>'branch_id')::uuid
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Optional: Initial Dummy Lab Branch for seeding
INSERT INTO public.lab_branches (name, code, address, contact_phone, contact_email)
VALUES ('Main Diagnostic Center', 'MAIN-01', '123 Healthcare Blvd, Medical District', '+91 9876543210', 'info@laberp.com')
ON CONFLICT (code) DO NOTHING;
