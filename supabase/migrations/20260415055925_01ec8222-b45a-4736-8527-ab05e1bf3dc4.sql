-- Add explicit DELETE policy for admins on accelerator_keys
CREATE POLICY "Admins can delete accelerator keys"
ON public.accelerator_keys
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));
