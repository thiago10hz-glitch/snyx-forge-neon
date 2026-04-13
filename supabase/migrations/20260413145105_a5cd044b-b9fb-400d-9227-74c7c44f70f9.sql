-- Add hosting_tier to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS hosting_tier text NOT NULL DEFAULT 'none';

-- Create hosted_sites table
CREATE TABLE public.hosted_sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  site_name text NOT NULL,
  html_content text NOT NULL,
  vercel_project_id text,
  vercel_url text,
  custom_domain text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.hosted_sites ENABLE ROW LEVEL SECURITY;

-- Users can view own sites
CREATE POLICY "Users can view own hosted sites"
ON public.hosted_sites FOR SELECT TO public
USING (auth.uid() = user_id);

-- Users can create sites
CREATE POLICY "Users can create hosted sites"
ON public.hosted_sites FOR INSERT TO public
WITH CHECK (auth.uid() = user_id);

-- Users can update own sites
CREATE POLICY "Users can update own hosted sites"
ON public.hosted_sites FOR UPDATE TO public
USING (auth.uid() = user_id);

-- Users can delete own sites
CREATE POLICY "Users can delete own hosted sites"
ON public.hosted_sites FOR DELETE TO public
USING (auth.uid() = user_id);

-- Admins can view all
CREATE POLICY "Admins can view all hosted sites"
ON public.hosted_sites FOR SELECT TO public
USING (has_role(auth.uid(), 'admin'));

-- Admins can update all
CREATE POLICY "Admins can update all hosted sites"
ON public.hosted_sites FOR UPDATE TO public
USING (has_role(auth.uid(), 'admin'));

-- Admins can delete all
CREATE POLICY "Admins can delete all hosted sites"
ON public.hosted_sites FOR DELETE TO public
USING (has_role(auth.uid(), 'admin'));

-- Function to check hosting limits
CREATE OR REPLACE FUNCTION public.check_hosting_limit()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tier text;
  v_count integer;
  v_max integer;
BEGIN
  SELECT hosting_tier INTO v_tier FROM profiles WHERE user_id = auth.uid();
  IF v_tier IS NULL OR v_tier = 'none' THEN
    RETURN json_build_object('allowed', false, 'reason', 'no_plan', 'current', 0, 'max', 0);
  END IF;
  SELECT COUNT(*) INTO v_count FROM hosted_sites WHERE user_id = auth.uid() AND status = 'active';
  IF v_tier = 'basic' THEN v_max := 3;
  ELSIF v_tier = 'pro' THEN v_max := 10;
  ELSIF v_tier = 'unlimited' THEN v_max := 999;
  ELSE v_max := 0;
  END IF;
  IF v_count >= v_max THEN
    RETURN json_build_object('allowed', false, 'reason', 'limit_reached', 'current', v_count, 'max', v_max);
  END IF;
  RETURN json_build_object('allowed', true, 'current', v_count, 'max', v_max, 'tier', v_tier);
END;
$$;