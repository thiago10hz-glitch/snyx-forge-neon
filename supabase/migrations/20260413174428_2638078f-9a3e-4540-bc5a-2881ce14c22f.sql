
CREATE POLICY "Admins can delete live chats"
ON public.admin_live_chats
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete live messages"
ON public.admin_live_messages
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
