-- ============================================================
-- LAB ERP — Migration V8: Persistent Branch Configurations
-- ============================================================
-- Run this in your Supabase SQL Editor so your branch UPI,
-- logo, lab name, and invoice notes persist across all devices.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.branch_configurations (
  branch_id TEXT PRIMARY KEY,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.branch_configurations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read branch configurations" ON public.branch_configurations;
CREATE POLICY "Anyone can read branch configurations" ON public.branch_configurations
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage branch configurations" ON public.branch_configurations;
CREATE POLICY "Admins can manage branch configurations" ON public.branch_configurations
  FOR ALL USING (true);

GRANT ALL ON public.branch_configurations TO authenticated, service_role, anon;
