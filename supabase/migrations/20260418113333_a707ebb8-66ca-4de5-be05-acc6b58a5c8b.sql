-- Adiciona campos de origem/geo nos logs
ALTER TABLE public.api_usage_logs
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS referer text,
  ADD COLUMN IF NOT EXISTS origin text,
  ADD COLUMN IF NOT EXISTS user_agent text,
  ADD COLUMN IF NOT EXISTS request_id text;

CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON public.api_usage_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_ip ON public.api_usage_logs (ip_address);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_client ON public.api_usage_logs (api_client_id, created_at DESC);

-- Habilita realtime
ALTER TABLE public.api_usage_logs REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.api_usage_logs;