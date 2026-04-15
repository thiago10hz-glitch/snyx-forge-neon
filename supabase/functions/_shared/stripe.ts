export type StripeEnv = 'sandbox' | 'live';

const GATEWAY_BASE = 'https://connector-gateway.lovable.dev/stripe';

function getKeys(env: StripeEnv) {
  const connectionKey = env === 'sandbox'
    ? Deno.env.get('STRIPE_SANDBOX_API_KEY')
    : Deno.env.get('STRIPE_LIVE_API_KEY');
  const lovableKey = Deno.env.get('LOVABLE_API_KEY');
  if (!connectionKey) throw new Error(`STRIPE_${env.toUpperCase()}_API_KEY is not configured`);
  if (!lovableKey) throw new Error('LOVABLE_API_KEY is not configured');
  return { connectionKey, lovableKey };
}

export async function stripeRequest(env: StripeEnv, method: string, path: string, body?: Record<string, any>): Promise<any> {
  const { connectionKey, lovableKey } = getKeys(env);

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${lovableKey}`,
    'X-Connection-Api-Key': connectionKey,
    'Lovable-API-Key': lovableKey,
  };

  let url = `${GATEWAY_BASE}${path}`;
  let fetchInit: RequestInit = { method, headers };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    fetchInit.body = encodeFormData(body);
  }

  const resp = await fetch(url, fetchInit);
  const data = await resp.json();

  if (!resp.ok) {
    const errMsg = data?.error?.message || data?.message || JSON.stringify(data);
    throw new Error(errMsg);
  }

  return data;
}

function encodeFormData(obj: Record<string, any>, prefix = ''): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}[${key}]` : key;
    if (value === null || value === undefined) continue;
    if (typeof value === 'object' && !Array.isArray(value)) {
      parts.push(encodeFormData(value, fullKey));
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === 'object') {
          parts.push(encodeFormData(item, `${fullKey}[${i}]`));
        } else {
          parts.push(`${encodeURIComponent(`${fullKey}[${i}]`)}=${encodeURIComponent(item)}`);
        }
      });
    } else {
      parts.push(`${encodeURIComponent(fullKey)}=${encodeURIComponent(value)}`);
    }
  }
  return parts.filter(Boolean).join('&');
}

export async function verifyWebhook(req: Request, env: StripeEnv): Promise<{ type: string; data: { object: any } }> {
  const { encode } = await import("https://deno.land/std@0.168.0/encoding/hex.ts");
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  const secret = env === 'sandbox'
    ? Deno.env.get('PAYMENTS_SANDBOX_WEBHOOK_SECRET')
    : Deno.env.get('PAYMENTS_LIVE_WEBHOOK_SECRET');

  if (!secret) throw new Error('Webhook secret environment variable is not configured');
  if (!signature || !body) throw new Error("Missing signature or body");

  let timestamp: string | undefined;
  const v1Signatures: string[] = [];
  for (const part of signature.split(",")) {
    const [key, value] = part.split("=", 2);
    if (key === "t") timestamp = value;
    if (key === "v1") v1Signatures.push(value);
  }

  if (!timestamp || v1Signatures.length === 0) throw new Error("Invalid signature format");

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (age > 300) throw new Error("Webhook timestamp too old");

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signed = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${timestamp}.${body}`)
  );
  const expected = new TextDecoder().decode(encode(new Uint8Array(signed)));

  if (!v1Signatures.includes(expected)) throw new Error("Invalid webhook signature");

  return JSON.parse(body);
}
