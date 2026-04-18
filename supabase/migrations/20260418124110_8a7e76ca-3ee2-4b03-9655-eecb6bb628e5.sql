
-- Tabela pra salvar histórico de músicas geradas
CREATE TABLE public.generated_music (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  prompt TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL DEFAULT 15,
  audio_url TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'facebook/musicgen-small',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.generated_music ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own music" ON public.generated_music
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own music" ON public.generated_music
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users delete own music" ON public.generated_music
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- Bucket público pra áudios
INSERT INTO storage.buckets (id, name, public) VALUES ('generated-music', 'generated-music', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view generated music files" ON storage.objects
  FOR SELECT USING (bucket_id = 'generated-music');

CREATE POLICY "Users upload own music files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'generated-music' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users delete own music files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'generated-music' AND auth.uid()::text = (storage.foldername(name))[1]);
