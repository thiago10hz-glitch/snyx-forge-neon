
-- Security audit log for tracking download attempts and tamper violations
CREATE TABLE public.security_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  event_type text NOT NULL DEFAULT 'download',
  resource text,
  ip_address text,
  user_agent text,
  details jsonb DEFAULT '{}'::jsonb,
  severity text NOT NULL DEFAULT 'info',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.security_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.security_audit_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role can insert audit logs
CREATE POLICY "Service role can manage audit logs"
ON public.security_audit_log
FOR ALL
USING ((SELECT auth.role()) = 'service_role')
WITH CHECK ((SELECT auth.role()) = 'service_role');

-- Index for fast lookups
CREATE INDEX idx_security_audit_user ON public.security_audit_log(user_id);
CREATE INDEX idx_security_audit_type ON public.security_audit_log(event_type);
CREATE INDEX idx_security_audit_severity ON public.security_audit_log(severity);

-- Function to handle security violation: ban user + revoke all access + delete files
CREATE OR REPLACE FUNCTION public.handle_security_violation(p_user_id uuid, p_reason text DEFAULT 'tamper_detected')
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Ban user for 100 years (effectively permanent)
  UPDATE profiles SET 
    banned_until = now() + interval '100 years',
    is_vip = false,
    is_dev = false,
    is_pack_steam = false,
    is_rpg_premium = false,
    vip_expires_at = NULL,
    dev_expires_at = NULL,
    pack_steam_expires_at = NULL,
    rpg_premium_expires_at = NULL,
    hosting_tier = 'none'
  WHERE user_id = p_user_id;

  -- Log the violation
  INSERT INTO security_audit_log (user_id, event_type, severity, details)
  VALUES (p_user_id, 'security_violation', 'critical', json_build_object('reason', p_reason)::jsonb);

  RETURN json_build_object('success', true, 'action', 'user_banned_and_access_revoked');
END;
$$;
