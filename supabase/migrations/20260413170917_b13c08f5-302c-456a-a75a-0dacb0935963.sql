
-- Table for admin live chat requests
CREATE TABLE public.admin_live_chats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  admin_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  subject TEXT NOT NULL DEFAULT 'Chat ao vivo',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_live_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create live chat requests"
  ON public.admin_live_chats FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own live chats"
  ON public.admin_live_chats FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all live chats"
  ON public.admin_live_chats FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update live chats"
  ON public.admin_live_chats FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own live chats"
  ON public.admin_live_chats FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Table for live chat messages
CREATE TABLE public.admin_live_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  chat_id UUID NOT NULL REFERENCES public.admin_live_chats(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_live_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view messages"
  ON public.admin_live_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.admin_live_chats
      WHERE id = admin_live_messages.chat_id
        AND (user_id = auth.uid() OR admin_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Participants can send messages"
  ON public.admin_live_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.admin_live_chats
      WHERE id = admin_live_messages.chat_id
        AND status = 'active'
        AND (user_id = auth.uid() OR admin_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_live_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_live_messages;
