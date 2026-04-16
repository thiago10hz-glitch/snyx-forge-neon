
-- Table for clone site demos
CREATE TABLE public.clone_demos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  site_name text NOT NULL,
  primary_color text NOT NULL DEFAULT '#ff0000',
  description text,
  status text NOT NULL DEFAULT 'active',
  device_fingerprint text,
  ip_address text,
  demo_url text,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clone_demos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own demos" ON public.clone_demos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create demos" ON public.clone_demos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all demos" ON public.clone_demos
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role can manage demos" ON public.clone_demos
  FOR ALL USING ((SELECT auth.role()) = 'service_role')
  WITH CHECK ((SELECT auth.role()) = 'service_role');

-- Function to check if user can use demo (only 1 per person, checks fingerprint and IP too)
CREATE OR REPLACE FUNCTION public.can_use_demo(p_fingerprint text DEFAULT NULL, p_ip text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check by user_id
  IF EXISTS (SELECT 1 FROM clone_demos WHERE user_id = auth.uid()) THEN
    RETURN json_build_object('allowed', false, 'reason', 'already_used', 'message', 'Você já utilizou sua demonstração gratuita.');
  END IF;

  -- Check by fingerprint
  IF p_fingerprint IS NOT NULL AND EXISTS (
    SELECT 1 FROM clone_demos WHERE device_fingerprint = p_fingerprint
  ) THEN
    RETURN json_build_object('allowed', false, 'reason', 'fingerprint_blocked', 'message', 'Demonstração já utilizada neste dispositivo.');
  END IF;

  -- Check by IP
  IF p_ip IS NOT NULL AND EXISTS (
    SELECT 1 FROM clone_demos WHERE ip_address = p_ip
  ) THEN
    RETURN json_build_object('allowed', false, 'reason', 'ip_blocked', 'message', 'Demonstração já utilizada neste endereço de rede.');
  END IF;

  RETURN json_build_object('allowed', true);
END;
$$;

-- Function to cleanup expired demos
CREATE OR REPLACE FUNCTION public.cleanup_expired_demos()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE clone_demos SET status = 'expired' WHERE status = 'active' AND expires_at < now();
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
