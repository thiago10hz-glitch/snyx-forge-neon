CREATE TABLE public.dev_projects (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT 'Meu Site',
  html_content TEXT NOT NULL DEFAULT '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Novo site</title></head><body><h1>Olá mundo</h1></body></html>',
  vercel_project_id TEXT,
  vercel_project_name TEXT,
  vercel_url TEXT,
  last_deployed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.dev_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own dev projects"
ON public.dev_projects FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own dev projects"
ON public.dev_projects FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own dev projects"
ON public.dev_projects FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users delete own dev projects"
ON public.dev_projects FOR DELETE
TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_dev_projects_updated_at
BEFORE UPDATE ON public.dev_projects
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_dev_projects_user ON public.dev_projects(user_id);