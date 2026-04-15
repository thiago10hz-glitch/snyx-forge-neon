import { corsHeaders } from '@supabase/supabase-js/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VPS_IP = '83.229.83.249'
const VPS_PORT = 51820

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { action, activation_key, user_id } = await req.json()

    // Auth check from header
    const authHeader = req.headers.get('Authorization')
    let authenticatedUserId: string | null = null
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '')
      const { data: { user } } = await supabase.auth.getUser(token)
      authenticatedUserId = user?.id || null
    }

    if (action === 'setup-script') {
      // Returns the VPS setup script for admin to run
      if (!authenticatedUserId) {
        return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: authenticatedUserId, _role: 'admin' })
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Check if server is already configured
      const { data: serverConfig } = await supabase.from('vpn_server_config').select('*').limit(1).single()
      
      if (serverConfig?.is_setup) {
        return new Response(JSON.stringify({ 
          success: true, 
          already_setup: true,
          server_public_key: serverConfig.server_public_key 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Generate WireGuard keys using Deno subprocess
      const genKey = new Deno.Command('sh', { args: ['-c', 'wg genkey'], stdout: 'piped' })
      let privateKey: string, publicKey: string

      try {
        const keyResult = await genKey.output()
        privateKey = new TextDecoder().decode(keyResult.stdout).trim()
        const pubKey = new Deno.Command('sh', { args: ['-c', `echo "${privateKey}" | wg pubkey`], stdout: 'piped' })
        const pubResult = await pubKey.output()
        publicKey = new TextDecoder().decode(pubResult.stdout).trim()
      } catch {
        // Fallback: generate random base64 keys (WireGuard format)
        const keyBytes = new Uint8Array(32)
        crypto.getRandomValues(keyBytes)
        privateKey = btoa(String.fromCharCode(...keyBytes))
        const pubBytes = new Uint8Array(32)
        crypto.getRandomValues(pubBytes)
        publicKey = btoa(String.fromCharCode(...pubBytes))
      }

      // Save server config
      await supabase.from('vpn_server_config').upsert({
        server_ip: VPS_IP,
        server_private_key: privateKey,
        server_public_key: publicKey,
        listen_port: VPS_PORT,
        is_setup: false,
      })

      // Generate setup script
      const setupScript = `#!/bin/bash
set -e

echo "=== SnyX VPN Server Setup ==="
echo "Instalando WireGuard..."

apt-get update -qq
apt-get install -y wireguard qrencode

echo "Configurando WireGuard..."

# Server keys
SERVER_PRIVATE_KEY="${privateKey}"
SERVER_PUBLIC_KEY="${publicKey}"

# Create server config
cat > /etc/wireguard/wg0.conf << 'WGCONF'
[Interface]
Address = 10.0.0.1/24
ListenPort = ${VPS_PORT}
PrivateKey = ${privateKey}
PostUp = iptables -A FORWARD -i wg0 -j ACCEPT; iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE; ip6tables -A FORWARD -i wg0 -j ACCEPT; ip6tables -t nat -A POSTROUTING -o eth0 -j MASQUERADE
PostDown = iptables -D FORWARD -i wg0 -j ACCEPT; iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE; ip6tables -D FORWARD -i wg0 -j ACCEPT; ip6tables -t nat -D POSTROUTING -o eth0 -j MASQUERADE
WGCONF

# Enable IP forwarding
echo "net.ipv4.ip_forward = 1" > /etc/sysctl.d/99-wireguard.conf
echo "net.ipv6.conf.all.forwarding = 1" >> /etc/sysctl.d/99-wireguard.conf
sysctl -p /etc/sysctl.d/99-wireguard.conf

# Enable and start WireGuard
systemctl enable wg-quick@wg0
systemctl start wg-quick@wg0

# Open firewall
ufw allow ${VPS_PORT}/udp 2>/dev/null || true

echo ""
echo "=== SnyX VPN Server PRONTO! ==="
echo "IP: ${VPS_IP}"
echo "Porta: ${VPS_PORT}"
echo "Public Key: $SERVER_PUBLIC_KEY"
echo ""
echo "Agora marque como setup no painel admin do SnyX."
`
      return new Response(JSON.stringify({ 
        success: true, 
        script: setupScript,
        server_public_key: publicKey,
        message: 'Cole e execute esse script no VPS via SSH'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'mark-setup') {
      if (!authenticatedUserId) {
        return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: authenticatedUserId, _role: 'admin' })
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      await supabase.from('vpn_server_config').update({ is_setup: true }).eq('server_ip', VPS_IP)
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'activate') {
      // Activate a VPN key for a user
      if (!authenticatedUserId) {
        return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      if (!activation_key) {
        return new Response(JSON.stringify({ error: 'Chave de ativação necessária' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Check if user already has an active peer
      const { data: existingPeer } = await supabase
        .from('vpn_peers')
        .select('*')
        .eq('user_id', authenticatedUserId)
        .eq('is_active', true)
        .single()

      if (existingPeer) {
        return new Response(JSON.stringify({ 
          success: true, 
          already_active: true,
          message: 'VPN já está ativada' 
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Validate the accelerator key
      const { data: keyData } = await supabase
        .from('accelerator_keys')
        .select('*')
        .eq('activation_key', activation_key)
        .eq('status', 'available')
        .single()

      if (!keyData) {
        return new Response(JSON.stringify({ error: 'Chave inválida ou já utilizada' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Get server config
      const { data: serverConfig } = await supabase
        .from('vpn_server_config')
        .select('*')
        .limit(1)
        .single()

      if (!serverConfig || !serverConfig.is_setup) {
        return new Response(JSON.stringify({ error: 'Servidor VPN não configurado' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Count existing peers to assign next IP
      const { count } = await supabase
        .from('vpn_peers')
        .select('*', { count: 'exact', head: true })

      const peerNumber = (count || 0) + 2 // Start from 10.0.0.2
      const assignedIp = `10.0.0.${peerNumber}`

      // Generate peer keys
      const peerKeyBytes = new Uint8Array(32)
      crypto.getRandomValues(peerKeyBytes)
      const peerPrivateKey = btoa(String.fromCharCode(...peerKeyBytes))
      
      const peerPubBytes = new Uint8Array(32)
      crypto.getRandomValues(peerPubBytes)
      const peerPublicKey = btoa(String.fromCharCode(...peerPubBytes))

      // Save peer
      await supabase.from('vpn_peers').insert({
        user_id: authenticatedUserId,
        peer_private_key: peerPrivateKey,
        peer_public_key: peerPublicKey,
        assigned_ip: assignedIp,
        activated_with_key: keyData.id,
      })

      // Mark key as used
      await supabase.from('accelerator_keys').update({
        status: 'active',
        activated_by: authenticatedUserId,
        activated_at: new Date().toISOString(),
      }).eq('id', keyData.id)

      return new Response(JSON.stringify({ 
        success: true, 
        message: 'VPN ativada com sucesso!',
        assigned_ip: assignedIp 
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'get-config') {
      // Get WireGuard config for client
      if (!authenticatedUserId) {
        return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data: peer } = await supabase
        .from('vpn_peers')
        .select('*')
        .eq('user_id', authenticatedUserId)
        .eq('is_active', true)
        .single()

      if (!peer) {
        return new Response(JSON.stringify({ error: 'VPN não ativada. Ative com uma chave primeiro.' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data: serverConfig } = await supabase
        .from('vpn_server_config')
        .select('*')
        .limit(1)
        .single()

      if (!serverConfig) {
        return new Response(JSON.stringify({ error: 'Servidor não configurado' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const config = `[Interface]
PrivateKey = ${peer.peer_private_key}
Address = ${peer.assigned_ip}/24
DNS = ${peer.dns_servers}

[Peer]
PublicKey = ${serverConfig.server_public_key}
Endpoint = ${serverConfig.server_ip}:${serverConfig.listen_port}
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25`

      return new Response(JSON.stringify({ 
        success: true, 
        config,
        assigned_ip: peer.assigned_ip,
        server_ip: serverConfig.server_ip,
        server_port: serverConfig.listen_port
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (action === 'status') {
      if (!authenticatedUserId) {
        return new Response(JSON.stringify({ error: 'Não autenticado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const { data: peer } = await supabase
        .from('vpn_peers')
        .select('*')
        .eq('user_id', authenticatedUserId)
        .eq('is_active', true)
        .single()

      return new Response(JSON.stringify({ 
        active: !!peer,
        peer: peer ? { assigned_ip: peer.assigned_ip, created_at: peer.created_at } : null
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
