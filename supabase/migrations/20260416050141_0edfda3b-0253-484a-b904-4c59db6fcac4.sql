
ALTER TABLE public.clone_demos 
  ADD COLUMN IF NOT EXISTS vercel_project_id text,
  ADD COLUMN IF NOT EXISTS vercel_deployment_id text,
  ADD COLUMN IF NOT EXISTS hosted_url text;
