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

  // Handle fraud/ban responses
  if (error) {
    throw new Error(error.message || "Falha ao criar checkout do Mercado Pago");
  }

  if (data?.error === "fraud_warning") {
    throw new Error(data.message || "Tentativa de manipulação detectada");
  }

  if (data?.error === "banned") {
    throw new Error(data.message || "Conta suspensa temporariamente");
  }

  if (!data?.init_point) {
    throw new Error("Falha ao criar checkout do Mercado Pago");
  }

  return data.sandbox_init_point || data.init_point;
}
