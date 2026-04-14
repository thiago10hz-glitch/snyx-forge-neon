
-- ============================================
-- 1. FIX STORAGE BUCKETS
-- ============================================

-- Make support-images private
UPDATE storage.buckets SET public = false WHERE id = 'support-images';

-- Drop overly broad SELECT policies on storage.objects
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Public access to iptv-cache" ON storage.objects;
DROP POLICY IF EXISTS "Public access support images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view support images" ON storage.objects;
DROP POLICY IF EXISTS "support images public read" ON storage.objects;
DROP POLICY IF EXISTS "iptv cache public select" ON storage.objects;

-- Avatars: publicly readable (needed for display)
CREATE POLICY "Avatars are publicly readable"
ON storage.objects
FOR SELECT
USING (bucket_id = 'avatars');

-- IPTV cache: only authenticated users
CREATE POLICY "Authenticated users can read iptv cache"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'iptv-cache');

-- Support images: only ticket owner or admin
CREATE POLICY "Support images accessible by owner or admin"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'support-images'
  AND (
    auth.uid()::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin')
  )
);

-- ============================================
-- 2. FIX user_tracking POLICIES
-- ============================================

CREATE POLICY "Users can view own tracking"
ON public.user_tracking
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tracking"
ON public.user_tracking
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- ============================================
-- 3. FIX license_keys POLICIES
-- ============================================

CREATE POLICY "Users can view own license keys"
ON public.license_keys
FOR SELECT
TO authenticated
USING (used_by_user_id = auth.uid());
