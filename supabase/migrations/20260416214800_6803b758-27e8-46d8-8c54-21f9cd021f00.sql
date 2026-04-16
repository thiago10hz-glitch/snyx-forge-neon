
ALTER TABLE public.ai_characters 
  ADD COLUMN IF NOT EXISTS first_message text DEFAULT '',
  ADD COLUMN IF NOT EXISTS scenario text DEFAULT '',
  ADD COLUMN IF NOT EXISTS example_dialog text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_nsfw boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banner_url text,
  ADD COLUMN IF NOT EXISTS language text NOT NULL DEFAULT 'pt-BR';

CREATE INDEX IF NOT EXISTS idx_ai_characters_category ON public.ai_characters(category);
CREATE INDEX IF NOT EXISTS idx_ai_characters_chat_count ON public.ai_characters(chat_count DESC);
CREATE INDEX IF NOT EXISTS idx_ai_characters_likes_count ON public.ai_characters(likes_count DESC);
CREATE INDEX IF NOT EXISTS idx_ai_characters_is_public ON public.ai_characters(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_ai_characters_is_nsfw ON public.ai_characters(is_nsfw);
