DROP POLICY IF EXISTS "Users can create messages" ON public.chat_messages;

CREATE POLICY "Users can create messages"
ON public.chat_messages
FOR INSERT
TO public
WITH CHECK (
  role = ANY (ARRAY['user'::text, 'assistant'::text])
  AND EXISTS (
    SELECT 1
    FROM public.chat_conversations
    WHERE chat_conversations.id = chat_messages.conversation_id
      AND chat_conversations.user_id = auth.uid()
  )
);