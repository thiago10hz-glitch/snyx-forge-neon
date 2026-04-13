-- Add Pack Steam fields to profiles
ALTER TABLE public.profiles ADD COLUMN is_pack_steam boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN pack_steam_expires_at timestamp with time zone;

-- Create admin function to grant Pack Steam
CREATE OR REPLACE FUNCTION public.admin_grant_pack_steam(p_target_user_id uuid, p_months integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Não autorizado');
  END IF;
  UPDATE profiles SET is_pack_steam = true, pack_steam_expires_at = now() + (p_months || ' months')::interval WHERE user_id = p_target_user_id;
  RETURN json_build_object('success', true);
END;
$$;

-- Create admin function to revoke Pack Steam
CREATE OR REPLACE FUNCTION public.admin_revoke_pack_steam(p_target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Não autorizado');
  END IF;
  UPDATE profiles SET is_pack_steam = false, pack_steam_expires_at = NULL WHERE user_id = p_target_user_id;
  RETURN json_build_object('success', true);
END;
$$;

-- Update the user update policy to prevent users from changing pack_steam themselves
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  (auth.uid() = user_id)
  AND (is_vip = (SELECT p.is_vip FROM profiles p WHERE p.user_id = auth.uid()))
  AND (is_dev = (SELECT p.is_dev FROM profiles p WHERE p.user_id = auth.uid()))
  AND (is_pack_steam = (SELECT p.is_pack_steam FROM profiles p WHERE p.user_id = auth.uid()))
  AND (NOT (vip_expires_at IS DISTINCT FROM (SELECT p.vip_expires_at FROM profiles p WHERE p.user_id = auth.uid())))
  AND (NOT (dev_expires_at IS DISTINCT FROM (SELECT p.dev_expires_at FROM profiles p WHERE p.user_id = auth.uid())))
  AND (NOT (pack_steam_expires_at IS DISTINCT FROM (SELECT p.pack_steam_expires_at FROM profiles p WHERE p.user_id = auth.uid())))
  AND (NOT (banned_until IS DISTINCT FROM (SELECT p.banned_until FROM profiles p WHERE p.user_id = auth.uid())))
  AND (free_messages_used = (SELECT p.free_messages_used FROM profiles p WHERE p.user_id = auth.uid()))
  AND (NOT (last_free_message_at IS DISTINCT FROM (SELECT p.last_free_message_at FROM profiles p WHERE p.user_id = auth.uid())))
);

-- Allow Pack Steam users to view releases too
DROP POLICY IF EXISTS "VIP and DEV can view releases" ON public.app_releases;
CREATE POLICY "VIP DEV and Pack Steam can view releases"
ON public.app_releases FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.user_id = auth.uid()
    AND (profiles.is_vip = true OR profiles.is_dev = true OR profiles.is_pack_steam = true)
  )
);