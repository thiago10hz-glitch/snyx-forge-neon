
CREATE TABLE public.video_generations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  prompt text NOT NULL,
  mode text NOT NULL DEFAULT 'text_to_video',
  status text NOT NULL DEFAULT 'pending',
  result_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own generations"
ON public.video_generations FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert own generations"
ON public.video_generations FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Admins can view all generations"
ON public.video_generations FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages generations"
ON public.video_generations FOR ALL
USING ((SELECT auth.role()) = 'service_role')
WITH CHECK ((SELECT auth.role()) = 'service_role');
