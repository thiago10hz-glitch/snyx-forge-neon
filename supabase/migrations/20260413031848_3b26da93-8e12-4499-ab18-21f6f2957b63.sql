INSERT INTO storage.buckets (id, name, public) VALUES ('iptv-cache', 'iptv-cache', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read iptv-cache" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'iptv-cache');