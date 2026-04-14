DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

CREATE POLICY "Users can update own profile"
ON profiles FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (
  (auth.uid() = user_id)
  AND (is_vip = (SELECT p.is_vip FROM profiles p WHERE p.user_id = auth.uid()))
  AND (is_dev = (SELECT p.is_dev FROM profiles p WHERE p.user_id = auth.uid()))
  AND (is_pack_steam = (SELECT p.is_pack_steam FROM profiles p WHERE p.user_id = auth.uid()))
  AND (is_rpg_premium = (SELECT p.is_rpg_premium FROM profiles p WHERE p.user_id = auth.uid()))
  AND (NOT (vip_expires_at IS DISTINCT FROM (SELECT p.vip_expires_at FROM profiles p WHERE p.user_id = auth.uid())))
  AND (NOT (dev_expires_at IS DISTINCT FROM (SELECT p.dev_expires_at FROM profiles p WHERE p.user_id = auth.uid())))
  AND (NOT (pack_steam_expires_at IS DISTINCT FROM (SELECT p.pack_steam_expires_at FROM profiles p WHERE p.user_id = auth.uid())))
  AND (NOT (rpg_premium_expires_at IS DISTINCT FROM (SELECT p.rpg_premium_expires_at FROM profiles p WHERE p.user_id = auth.uid())))
  AND (NOT (banned_until IS DISTINCT FROM (SELECT p.banned_until FROM profiles p WHERE p.user_id = auth.uid())))
  AND (free_messages_used = (SELECT p.free_messages_used FROM profiles p WHERE p.user_id = auth.uid()))
  AND (NOT (last_free_message_at IS DISTINCT FROM (SELECT p.last_free_message_at FROM profiles p WHERE p.user_id = auth.uid())))
);