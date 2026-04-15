import { useState, useCallback } from "react";
import { createMercadoPagoCheckout } from "@/lib/mercadopago";

interface CheckoutOptions {
  title: string;
  description?: string;
  price: number;
  quantity?: number;
  userId?: string;
  userEmail?: string;
}

export function useMercadoPagoCheckout() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const openCheckout = useCallback(async (opts: CheckoutOptions) => {
    setIsLoading(true);
    setError(null);
    try {
      const checkoutUrl = await createMercadoPagoCheckout(opts);
      window.location.href = checkoutUrl;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao criar checkout";
      setError(msg);
      setIsLoading(false);
    }
  }, []);

  return { openCheckout, isLoading, error };
}
