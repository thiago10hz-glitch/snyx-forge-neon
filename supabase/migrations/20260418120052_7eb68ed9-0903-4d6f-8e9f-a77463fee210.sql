-- 1. Adicionar age_verified em profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS age_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS age_verified_at timestamp with time zone;

-- 2. Atualizar RLS de ai_characters: NSFW só pra age_verified
DROP POLICY IF EXISTS "Anyone can view public characters" ON public.ai_characters;

CREATE POLICY "View public characters with age gate"
ON public.ai_characters
FOR SELECT
TO authenticated
USING (
  (creator_id = auth.uid())
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (
    is_public = true
    AND (
      is_nsfw = false
      OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.user_id = auth.uid()
          AND profiles.age_verified = true
      )
    )
  )
);

-- 3. Atualizar a RLS UPDATE de profiles pra permitir o user marcar age_verified
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
TO public
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND is_vip = (SELECT p.is_vip FROM profiles p WHERE p.user_id = auth.uid())
  AND is_dev = (SELECT p.is_dev FROM profiles p WHERE p.user_id = auth.uid())
  AND is_pack_steam = (SELECT p.is_pack_steam FROM profiles p WHERE p.user_id = auth.uid())
  AND is_rpg_premium = (SELECT p.is_rpg_premium FROM profiles p WHERE p.user_id = auth.uid())
  AND NOT (vip_expires_at IS DISTINCT FROM (SELECT p.vip_expires_at FROM profiles p WHERE p.user_id = auth.uid()))
  AND NOT (dev_expires_at IS DISTINCT FROM (SELECT p.dev_expires_at FROM profiles p WHERE p.user_id = auth.uid()))
  AND NOT (pack_steam_expires_at IS DISTINCT FROM (SELECT p.pack_steam_expires_at FROM profiles p WHERE p.user_id = auth.uid()))
  AND NOT (rpg_premium_expires_at IS DISTINCT FROM (SELECT p.rpg_premium_expires_at FROM profiles p WHERE p.user_id = auth.uid()))
  AND NOT (banned_until IS DISTINCT FROM (SELECT p.banned_until FROM profiles p WHERE p.user_id = auth.uid()))
  AND free_messages_used = (SELECT p.free_messages_used FROM profiles p WHERE p.user_id = auth.uid())
  AND NOT (last_free_message_at IS DISTINCT FROM (SELECT p.last_free_message_at FROM profiles p WHERE p.user_id = auth.uid()))
  AND NOT (team_badge IS DISTINCT FROM (SELECT p.team_badge FROM profiles p WHERE p.user_id = auth.uid()))
);

-- 4. Índice pra ranking do catálogo
CREATE INDEX IF NOT EXISTS idx_ai_characters_public_chats
  ON public.ai_characters (is_public, chat_count DESC)
  WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_ai_characters_category
  ON public.ai_characters (category)
  WHERE is_public = true;