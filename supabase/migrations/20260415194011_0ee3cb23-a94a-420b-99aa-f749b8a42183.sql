
-- Table for player RPG characters (the character the USER plays as)
CREATE TABLE public.rpg_player_characters (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  class TEXT NOT NULL DEFAULT 'Guerreiro',
  race TEXT NOT NULL DEFAULT 'Humano',
  backstory TEXT DEFAULT '',
  personality TEXT DEFAULT '',
  avatar_url TEXT,
  level INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Only one active character per user
CREATE UNIQUE INDEX rpg_player_characters_active_idx ON public.rpg_player_characters (user_id) WHERE is_active = true;

-- RLS
ALTER TABLE public.rpg_player_characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own rpg characters"
  ON public.rpg_player_characters FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create rpg characters"
  ON public.rpg_player_characters FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own rpg characters"
  ON public.rpg_player_characters FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own rpg characters"
  ON public.rpg_player_characters FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all rpg characters"
  ON public.rpg_player_characters FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));
