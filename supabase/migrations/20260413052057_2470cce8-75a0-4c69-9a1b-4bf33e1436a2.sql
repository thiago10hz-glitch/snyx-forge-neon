
-- Connection requests between users
CREATE TABLE public.chat_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL,
  target_email TEXT NOT NULL,
  target_user_id UUID,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create connection requests"
ON public.chat_connections FOR INSERT
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can view own connections"
ON public.chat_connections FOR SELECT
USING (auth.uid() = requester_id OR auth.uid() = target_user_id);

CREATE POLICY "Admins can view all connections"
ON public.chat_connections FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update connections"
ON public.chat_connections FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Shared chat rooms between two connected users
CREATE TABLE public.chat_shared_rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID NOT NULL REFERENCES public.chat_connections(id) ON DELETE CASCADE,
  user1_id UUID NOT NULL,
  user2_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'Chat Compartilhado',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_shared_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view shared rooms"
ON public.chat_shared_rooms FOR SELECT
USING (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Admins can view all shared rooms"
ON public.chat_shared_rooms FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage shared rooms"
ON public.chat_shared_rooms FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Messages in shared rooms
CREATE TABLE public.chat_shared_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.chat_shared_rooms(id) ON DELETE CASCADE,
  sender_id UUID,
  role TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_shared_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view shared messages"
ON public.chat_shared_messages FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.chat_shared_rooms
  WHERE id = chat_shared_messages.room_id
  AND (user1_id = auth.uid() OR user2_id = auth.uid())
));

CREATE POLICY "Participants can send shared messages"
ON public.chat_shared_messages FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.chat_shared_rooms
  WHERE id = chat_shared_messages.room_id
  AND (user1_id = auth.uid() OR user2_id = auth.uid())
));

CREATE POLICY "Admins can view all shared messages"
ON public.chat_shared_messages FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can send shared messages"
ON public.chat_shared_messages FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Enable realtime for shared messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_shared_messages;
