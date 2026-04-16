
DROP POLICY IF EXISTS "Users can view own vpn peer" ON vpn_peers;

CREATE POLICY "Users can view own vpn peer safe"
ON vpn_peers FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.get_my_vpn_config()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_peer vpn_peers%ROWTYPE;
  v_server vpn_server_config%ROWTYPE;
BEGIN
  SELECT * INTO v_peer FROM vpn_peers WHERE user_id = auth.uid() AND is_active = true LIMIT 1;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Nenhuma VPN ativa');
  END IF;
  SELECT * INTO v_server FROM vpn_server_config WHERE is_setup = true LIMIT 1;
  RETURN json_build_object(
    'success', true,
    'peer_public_key', v_peer.peer_public_key,
    'assigned_ip', v_peer.assigned_ip,
    'dns_servers', v_peer.dns_servers,
    'server_public_key', v_server.server_public_key,
    'server_ip', v_server.server_ip,
    'listen_port', v_server.listen_port
  );
END;
$$;

DROP POLICY IF EXISTS "Admins can manage vpn server config" ON vpn_server_config;

CREATE POLICY "Admins can view vpn server config"
ON vpn_server_config FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role manages vpn server config"
ON vpn_server_config FOR ALL
USING ((SELECT auth.role()) = 'service_role')
WITH CHECK ((SELECT auth.role()) = 'service_role');
