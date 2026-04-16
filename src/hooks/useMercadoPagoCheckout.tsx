import { useState, useCallback } from "react";
import { createMercadoPagoCheckout } from "@/lib/mercadopago";
import { toast } from "sonner";

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
    } catch (err: any) {
      const msg = err?.message || "Erro ao criar checkout";
      
      // Handle fraud detection responses
      if (msg.includes("fraud_warning") || msg.includes("manipulação")) {
        toast.error("⚠️ Tentativa de manipulação detectada!", {
          description: "Mais uma tentativa resultará em suspensão da sua conta.",
          duration: 8000,
        });
      } else if (msg.includes("banned") || msg.includes("suspensa")) {
        toast.error("🚫 Conta suspensa temporariamente", {
          description: "Sua conta foi suspensa por tentativa de fraude no sistema de pagamento.",
          duration: 10000,
        });
      } else {
        toast.error(msg);
      }
      
      setError(msg);
      setIsLoading(false);
    }
  }, []);

  return { openCheckout, isLoading, error };
}
