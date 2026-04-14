CREATE TABLE IF NOT EXISTS public.user_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  ip_address text,
  device_fingerprint text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_tracking ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_tracking_ip_address ON public.user_tracking (ip_address);
CREATE INDEX IF NOT EXISTS idx_user_tracking_device_fingerprint ON public.user_tracking (device_fingerprint);

CREATE OR REPLACE FUNCTION public.set_user_tracking_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_user_tracking_updated_at ON public.user_tracking;
CREATE TRIGGER set_user_tracking_updated_at
BEFORE UPDATE ON public.user_tracking
FOR EACH ROW
EXECUTE FUNCTION public.set_user_tracking_updated_at();

DROP POLICY IF EXISTS "Admins can view all user tracking" ON public.user_tracking;
CREATE POLICY "Admins can view all user tracking"
ON public.user_tracking
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "VIP DEV can download app files" ON storage.objects;
DROP POLICY IF EXISTS "VIP DEV and Pack Steam can download app files" ON storage.objects;
CREATE POLICY "VIP DEV and Pack Steam can download app files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'app-downloads'
  AND EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE profiles.user_id = auth.uid()
      AND (
        profiles.is_vip = true
        OR profiles.is_dev = true
        OR profiles.is_pack_steam = true
      )
  )
);