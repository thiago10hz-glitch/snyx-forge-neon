import { createClient } from "npm:@supabase/supabase-js@2";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { type StripeEnv, verifyWebhook } from "../_shared/stripe.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Map Stripe price lookup keys to profile flags
const PRICE_TO_FLAGS: Record<string, Record<string, any>> = {
  vip_monthly: { is_vip: true },
  rpg_monthly: { is_rpg_premium: true },
  dev_monthly: { is_dev: true },
  pack_steam_lifetime: { is_pack_steam: true },
};

function getExpirationField(priceId: string): string | null {
  const map: Record<string, string> = {
    vip_monthly: "vip_expires_at",
    rpg_monthly: "rpg_premium_expires_at",
    dev_monthly: "dev_expires_at",
    pack_steam_lifetime: "pack_steam_expires_at",
  };
  return map[priceId] || null;
}

async function activateEntitlement(userId: string, priceId: string, periodEnd: number | null) {
  const flags = PRICE_TO_FLAGS[priceId];
  if (!flags || !userId) return;

  const expirationField = getExpirationField(priceId);
  const update: Record<string, any> = { ...flags };

  if (expirationField && periodEnd) {
    update[expirationField] = new Date(periodEnd * 1000).toISOString();
  } else if (expirationField && priceId === "pack_steam_lifetime") {
    // Lifetime = 100 years
    update[expirationField] = new Date(Date.now() + 100 * 365 * 24 * 60 * 60 * 1000).toISOString();
  }

  await supabase.from("profiles").update(update).eq("user_id", userId);
  console.log(`Activated ${priceId} for user ${userId}`);
}

async function deactivateEntitlement(userId: string, priceId: string) {
  const flagKey = Object.keys(PRICE_TO_FLAGS[priceId] || {})[0];
  if (!flagKey || !userId) return;

  const expirationField = getExpirationField(priceId);
  const update: Record<string, any> = { [flagKey]: false };
  if (expirationField) update[expirationField] = null;

  await supabase.from("profiles").update(update).eq("user_id", userId);
  console.log(`Deactivated ${priceId} for user ${userId}`);
}

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const url = new URL(req.url);
  const env = (url.searchParams.get('env') || 'sandbox') as StripeEnv;

  try {
    const event = await verifyWebhook(req, env);
    console.log("Received event:", event.type, "env:", env);

    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, env);
        break;
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object, env);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object, env);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object, env);
        break;
      case "invoice.payment_failed":
        console.log("Payment failed:", event.data.object.id);
        break;
      default:
        console.log("Unhandled event:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Webhook error:", e);
    return new Response("Webhook error", { status: 400 });
  }
});

async function handleCheckoutCompleted(session: any, env: StripeEnv) {
  console.log("Checkout completed:", session.id, "mode:", session.mode);
  
  // For one-time payments (Pack Steam), activate entitlement directly
  if (session.mode === "payment") {
    const userId = session.metadata?.userId;
    if (!userId) return;

    // Get line items to determine which product was purchased
    // We store priceId in metadata or infer from the payment
    const priceId = session.metadata?.priceId || "pack_steam_lifetime";
    await activateEntitlement(userId, priceId, null);

    // Track in subscriptions table as a one-time purchase
    await supabase.from("subscriptions").upsert({
      user_id: userId,
      stripe_subscription_id: `onetime_${session.id}`,
      stripe_customer_id: session.customer || `cus_${session.id}`,
      product_id: "pack_steam",
      price_id: priceId,
      status: "active",
      environment: env,
      updated_at: new Date().toISOString(),
    }, { onConflict: "stripe_subscription_id" });
  }
}

async function handleSubscriptionCreated(subscription: any, env: StripeEnv) {
  const userId = subscription.metadata?.userId;
  if (!userId) {
    console.error("No userId in subscription metadata");
    return;
  }

  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.metadata?.lovable_external_id || item?.price?.lookup_key || item?.price?.id;
  const productId = item?.price?.product;

  const periodStart = subscription.current_period_start;
  const periodEnd = subscription.current_period_end;

  await supabase.from("subscriptions").upsert({
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer,
    product_id: productId,
    price_id: priceId,
    status: subscription.status,
    current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    environment: env,
    updated_at: new Date().toISOString(),
  }, { onConflict: "stripe_subscription_id" });

  // Activate profile flags
  await activateEntitlement(userId, priceId, periodEnd);
}

async function handleSubscriptionUpdated(subscription: any, env: StripeEnv) {
  const item = subscription.items?.data?.[0];
  const priceId = item?.price?.metadata?.lovable_external_id || item?.price?.lookup_key || item?.price?.id;
  const productId = item?.price?.product;

  const periodStart = subscription.current_period_start;
  const periodEnd = subscription.current_period_end;

  await supabase
    .from("subscriptions")
    .update({
      status: subscription.status,
      product_id: productId,
      price_id: priceId,
      current_period_start: periodStart ? new Date(periodStart * 1000).toISOString() : null,
      current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);

  // If subscription went active, re-activate entitlements
  if (subscription.status === "active") {
    const userId = subscription.metadata?.userId;
    if (userId) await activateEntitlement(userId, priceId, periodEnd);
  }
}

async function handleSubscriptionDeleted(subscription: any, env: StripeEnv) {
  await supabase
    .from("subscriptions")
    .update({
      status: "canceled",
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_subscription_id", subscription.id)
    .eq("environment", env);

  // Deactivate entitlements
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("user_id, price_id")
    .eq("stripe_subscription_id", subscription.id)
    .single();

  if (sub) {
    await deactivateEntitlement(sub.user_id, sub.price_id);
  }
}
