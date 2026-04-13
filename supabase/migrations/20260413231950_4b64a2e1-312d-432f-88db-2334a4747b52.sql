-- Allow admins to delete connections
CREATE POLICY "Admins can delete connections"
ON public.chat_connections
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete shared rooms
CREATE POLICY "Admins can delete shared rooms"
ON public.chat_shared_rooms
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to delete shared messages
CREATE POLICY "Admins can delete shared messages"
ON public.chat_shared_messages
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));