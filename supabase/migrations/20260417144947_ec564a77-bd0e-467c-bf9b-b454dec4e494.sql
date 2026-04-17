
CREATE TABLE public.api_key_applications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL,
  full_name text NOT NULL,
  company_or_project text NOT NULL,
  project_url text,
  use_case text NOT NULL,
  estimated_volume text,
  category text,
  status text NOT NULL DEFAULT 'pending',
  ai_score integer,
  ai_reasoning text,
  ai_verdict text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.api_key_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own applications"
  ON public.api_key_applications FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins manage applications"
  ON public.api_key_applications FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages applications"
  ON public.api_key_applications FOR ALL TO public
  USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

CREATE INDEX idx_api_key_apps_user ON public.api_key_applications(user_id);
CREATE INDEX idx_api_key_apps_status ON public.api_key_applications(status);
