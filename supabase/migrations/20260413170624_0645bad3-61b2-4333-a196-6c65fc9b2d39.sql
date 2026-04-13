
-- 1. Fix license_keys: drop the policy exposing key_code to regular users
DROP POLICY IF EXISTS "Users can view own redeemed key" ON public.license_keys;

-- 2. Fix admin_presence: restrict to authenticated users only
DROP POLICY IF EXISTS "Anyone can view admin presence" ON public.admin_presence;
CREATE POLICY "Authenticated users can view admin presence"
  ON public.admin_presence
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. Fix iptv-cache storage bucket: add INSERT and DELETE policies
CREATE POLICY "Users can upload to own iptv-cache folder"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'iptv-cache' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own iptv-cache files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'iptv-cache' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 4. Fix realtime: add RLS policies on realtime.messages
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can use realtime"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert realtime"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
