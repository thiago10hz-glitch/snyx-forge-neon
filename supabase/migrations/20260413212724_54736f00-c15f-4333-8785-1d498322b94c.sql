-- Add image_url to support_messages
ALTER TABLE public.support_messages ADD COLUMN image_url text;

-- Add image_url to admin_live_messages
ALTER TABLE public.admin_live_messages ADD COLUMN image_url text;

-- Create storage bucket for support images
INSERT INTO storage.buckets (id, name, public) VALUES ('support-images', 'support-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload support images
CREATE POLICY "Authenticated users can upload support images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'support-images');

-- Allow anyone to view support images (public bucket)
CREATE POLICY "Anyone can view support images"
ON storage.objects FOR SELECT
USING (bucket_id = 'support-images');

-- Allow authenticated users to delete their own support images
CREATE POLICY "Authenticated users can delete own support images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'support-images' AND auth.uid()::text = (storage.foldername(name))[1]);