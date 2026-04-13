
-- 1. Drop the dependent UPDATE policy on profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- 2. Now drop the columns
ALTER TABLE public.profiles DROP COLUMN IF EXISTS ip_address;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS device_fingerprint;

-- 3. Recreate the UPDATE policy without ip_address/device_fingerprint references
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND is_vip = (SELECT p.is_vip FROM profiles p WHERE p.user_id = auth.uid())
    AND is_dev = (SELECT p.is_dev FROM profiles p WHERE p.user_id = auth.uid())
    AND NOT (vip_expires_at IS DISTINCT FROM (SELECT p.vip_expires_at FROM profiles p WHERE p.user_id = auth.uid()))
    AND NOT (dev_expires_at IS DISTINCT FROM (SELECT p.dev_expires_at FROM profiles p WHERE p.user_id = auth.uid()))
    AND NOT (banned_until IS DISTINCT FROM (SELECT p.banned_until FROM profiles p WHERE p.user_id = auth.uid()))
    AND free_messages_used = (SELECT p.free_messages_used FROM profiles p WHERE p.user_id = auth.uid())
    AND NOT (last_free_message_at IS DISTINCT FROM (SELECT p.last_free_message_at FROM profiles p WHERE p.user_id = auth.uid()))
  );

-- 4. Update check_ip_duplicate to use user_tracking
CREATE OR REPLACE FUNCTION public.check_ip_duplicate(p_ip text, p_user_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_tracking WHERE ip_address = p_ip AND user_id != COALESCE(p_user_id, auth.uid())) THEN
    RETURN json_build_object('duplicate', true);
  END IF;
  INSERT INTO user_tracking (user_id, ip_address)
  VALUES (COALESCE(p_user_id, auth.uid()), p_ip)
  ON CONFLICT (user_id) DO UPDATE SET ip_address = p_ip, updated_at = now();
  RETURN json_build_object('duplicate', false);
END;
$$;

-- 5. Update check_fingerprint to use user_tracking
CREATE OR REPLACE FUNCTION public.check_fingerprint(p_fingerprint text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_tracking WHERE device_fingerprint = p_fingerprint AND user_id != auth.uid()) THEN
    RETURN json_build_object('duplicate', true);
  END IF;
  INSERT INTO user_tracking (user_id, device_fingerprint)
  VALUES (auth.uid(), p_fingerprint)
  ON CONFLICT (user_id) DO UPDATE SET device_fingerprint = p_fingerprint, updated_at = now();
  RETURN json_build_object('duplicate', false);
END;
$$;

-- 6. Fix iptv-cache bucket: drop existing policies and restrict
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies 
    WHERE tablename = 'objects' AND schemaname = 'storage'
    AND (qual LIKE '%iptv-cache%' OR with_check LIKE '%iptv-cache%')
    AND cmd = 'r'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END;
$$;

CREATE POLICY "Users can read own iptv-cache files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'iptv-cache' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 7. Block anon INSERT on user_roles
CREATE POLICY "Block public inserts on user_roles"
  ON public.user_roles FOR INSERT
  TO public
  WITH CHECK (false);
