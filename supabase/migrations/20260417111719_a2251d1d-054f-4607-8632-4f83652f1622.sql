CREATE TABLE IF NOT EXISTS public.app_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL,
  platform text NOT NULL DEFAULT 'windows',
  file_url text NOT NULL,
  file_size bigint,
  changelog text,
  uploaded_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_releases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage releases"
ON public.app_releases FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "VIP DEV and Pack Steam can view releases"
ON public.app_releases FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM profiles
  WHERE profiles.user_id = auth.uid()
    AND (profiles.is_vip = true OR profiles.is_dev = true OR profiles.is_pack_steam = true)
));