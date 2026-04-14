
-- Replace broad avatars policy with scoped one
DROP POLICY IF EXISTS "Avatars are publicly readable" ON storage.objects;

-- Avatars: anyone can read a specific file (needed for public display)
-- but scope to prevent full bucket listing by requiring a folder path
CREATE POLICY "Avatars readable by authenticated or public"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'avatars'
  AND (storage.foldername(name))[1] IS NOT NULL
);
