-- Fix 1: Restrict license_keys SELECT to only show user's own redeemed key
DROP POLICY IF EXISTS "Authenticated users can view keys" ON public.license_keys;

CREATE POLICY "Users can view own redeemed key"
ON public.license_keys
FOR SELECT
TO authenticated
USING (auth.uid() = used_by_user_id);

-- Also allow admins to see all keys
CREATE POLICY "Admins can view all license keys"
ON public.license_keys
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Also allow admins to manage keys
CREATE POLICY "Admins can insert license keys"
ON public.license_keys
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update license keys"
ON public.license_keys
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete license keys"
ON public.license_keys
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Fix 2: Add DELETE policy for avatars storage bucket
CREATE POLICY "Users can delete own avatar"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'avatars'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);