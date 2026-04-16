CREATE POLICY "Users can view partner profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id IN (
    SELECT partner_user_id FROM profiles WHERE user_id = auth.uid() AND partner_user_id IS NOT NULL
  )
);