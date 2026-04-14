
-- Create ai_characters table
CREATE TABLE public.ai_characters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  personality TEXT NOT NULL DEFAULT '',
  system_prompt TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'geral',
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN NOT NULL DEFAULT true,
  likes_count INTEGER NOT NULL DEFAULT 0,
  chat_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.ai_characters ENABLE ROW LEVEL SECURITY;

-- Everyone can view public characters
CREATE POLICY "Anyone can view public characters"
  ON public.ai_characters FOR SELECT
  TO authenticated
  USING (is_public = true OR creator_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Users can create characters
CREATE POLICY "Users can create characters"
  ON public.ai_characters FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

-- Users can update own characters
CREATE POLICY "Users can update own characters"
  ON public.ai_characters FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id OR has_role(auth.uid(), 'admin'));

-- Users can delete own characters
CREATE POLICY "Users can delete own characters"
  ON public.ai_characters FOR DELETE
  TO authenticated
  USING (auth.uid() = creator_id OR has_role(auth.uid(), 'admin'));

-- Add character_id to chat_conversations
ALTER TABLE public.chat_conversations ADD COLUMN character_id UUID REFERENCES public.ai_characters(id) ON DELETE SET NULL;

-- Character likes table
CREATE TABLE public.character_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  character_id UUID NOT NULL REFERENCES public.ai_characters(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(character_id, user_id)
);

ALTER TABLE public.character_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view likes"
  ON public.character_likes FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Users can like characters"
  ON public.character_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike characters"
  ON public.character_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
