-- Favorites table
CREATE TABLE IF NOT EXISTS public.character_favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  character_id uuid NOT NULL REFERENCES public.ai_characters(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, character_id)
);
ALTER TABLE public.character_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorites" ON public.character_favorites
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_char_fav_user ON public.character_favorites(user_id);

-- Long-term memory summaries per conversation
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL UNIQUE REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  summary text NOT NULL DEFAULT '',
  message_count_at_summary integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own summaries" ON public.conversation_summaries
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM chat_conversations c WHERE c.id = conversation_id AND c.user_id = auth.uid())
  );
CREATE POLICY "Service role manages summaries" ON public.conversation_summaries
  FOR ALL USING ((SELECT auth.role()) = 'service_role') WITH CHECK ((SELECT auth.role()) = 'service_role');

-- Reset all character counters
UPDATE public.ai_characters SET chat_count = 0, likes_count = 0;
DELETE FROM public.character_likes;