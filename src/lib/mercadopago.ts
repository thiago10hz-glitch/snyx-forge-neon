import { supabase } from "@/integrations/supabase/client";

interface CheckoutOptions {
  title: string;
  description?: string;
  price: number;
  quantity?: number;
  userId?: string;
  userEmail?: string;
}

export async function createMercadoPagoCheckout(options: CheckoutOptions): Promise<string> {
  const { data, error } = await supabase.functions.invoke("create-mercadopago-checkout", {
    body: {
      ...options,
      returnUrl: `${window.location.origin}/checkout/return`,
    },
  });

  if (error || !data?.init_point) {
    throw new Error(error?.message || "Falha ao criar checkout do Mercado Pago");
  }

  // Use sandbox_init_point for testing, init_point for production
  return data.sandbox_init_point || data.init_point;
}
