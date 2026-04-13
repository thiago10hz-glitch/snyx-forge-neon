-- Drop the overly broad SELECT policy on support-images
DROP POLICY IF EXISTS "Anyone can view support images" ON storage.objects;

-- Replace with a policy that prevents listing but allows viewing specific files
-- Users can only view files they uploaded (scoped by user folder)
CREATE POLICY "Users can view support images in own folder"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'support-images' 
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR has_role(auth.uid(), 'admin'::app_role)
  )
);

-- Fix avatars bucket - scope to own folder or public viewing by authenticated users
-- First check and drop any broad policies
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Authenticated users can view avatars"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'avatars');

-- Fix iptv-cache bucket  
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view iptv-cache" ON storage.objects;
CREATE POLICY "Authenticated users can view iptv cache"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'iptv-cache');