-- Table to persist voice call conversations
CREATE TABLE public.voice_call_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  voice_id text NOT NULL,
  gender text NOT NULL DEFAULT 'female',
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX voice_call_history_user_voice ON public.voice_call_history (user_id, voice_id);

ALTER TABLE public.voice_call_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own call history" ON public.voice_call_history
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own call history" ON public.voice_call_history
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own call history" ON public.voice_call_history
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own call history" ON public.voice_call_history
  FOR DELETE TO authenticated USING (auth.uid() = user_id);