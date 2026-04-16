-- Fix support-images upload policy to restrict path to user's own folder
DROP POLICY IF EXISTS "Authenticated users can upload support images" ON storage.objects;

CREATE POLICY "Authenticated users can upload support images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'support-images' 
  AND (auth.uid())::text = (storage.foldername(name))[1]
);