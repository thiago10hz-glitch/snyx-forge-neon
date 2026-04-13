
-- App releases table (latest version only approach)
CREATE TABLE public.app_releases (
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

-- Admins can do everything
CREATE POLICY "Admins can manage releases" ON public.app_releases
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- VIP/DEV users can view releases
CREATE POLICY "VIP and DEV can view releases" ON public.app_releases
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND (profiles.is_vip = true OR profiles.is_dev = true)
    )
  );

-- Storage bucket for app downloads
INSERT INTO storage.buckets (id, name, public) VALUES ('app-downloads', 'app-downloads', false);

-- Admin can upload to app-downloads
CREATE POLICY "Admins can upload app files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'app-downloads' AND has_role(auth.uid(), 'admin'));

-- Admins can manage app files
CREATE POLICY "Admins can manage app files" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'app-downloads' AND has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'app-downloads' AND has_role(auth.uid(), 'admin'));

-- VIP/DEV can download app files
CREATE POLICY "VIP DEV can download app files" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'app-downloads'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.user_id = auth.uid()
      AND (profiles.is_vip = true OR profiles.is_dev = true)
    )
  );
