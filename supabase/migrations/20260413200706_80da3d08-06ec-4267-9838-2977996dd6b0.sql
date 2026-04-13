
-- 1. Add CHECK constraints for role values
ALTER TABLE chat_messages
  ADD CONSTRAINT chat_messages_role_check
  CHECK (role IN ('user', 'assistant', 'system'));

ALTER TABLE chat_shared_messages
  ADD CONSTRAINT chat_shared_messages_role_check
  CHECK (role IN ('user', 'assistant'));

-- 2. Tighten chat_messages INSERT policy to only allow role='user' from clients
DROP POLICY IF EXISTS "Users can create messages" ON chat_messages;
CREATE POLICY "Users can create messages"
ON chat_messages FOR INSERT
TO public
WITH CHECK (
  role = 'user'
  AND EXISTS (
    SELECT 1 FROM chat_conversations
    WHERE chat_conversations.id = chat_messages.conversation_id
    AND chat_conversations.user_id = auth.uid()
  )
);

-- 3. Tighten chat_shared_messages INSERT policy for participants to enforce role='user'
DROP POLICY IF EXISTS "Participants can send shared messages" ON chat_shared_messages;
CREATE POLICY "Participants can send shared messages"
ON chat_shared_messages FOR INSERT
TO public
WITH CHECK (
  role = 'user'
  AND auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM chat_shared_rooms
    WHERE chat_shared_rooms.id = chat_shared_messages.room_id
    AND (chat_shared_rooms.user1_id = auth.uid() OR chat_shared_rooms.user2_id = auth.uid())
  )
);

-- 4. Fix support_messages INSERT policy to verify ticket ownership
DROP POLICY IF EXISTS "Users can send messages" ON support_messages;
CREATE POLICY "Users can send messages"
ON support_messages FOR INSERT
TO public
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM support_tickets
    WHERE support_tickets.id = support_messages.ticket_id
    AND support_tickets.user_id = auth.uid()
  )
);
