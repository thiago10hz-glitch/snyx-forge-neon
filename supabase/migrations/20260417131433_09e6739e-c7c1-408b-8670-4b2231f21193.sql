
-- Função utilitária para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================
-- 1. POOL DE CHAVES DE IA
-- ============================================
CREATE TABLE public.ai_provider_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider TEXT NOT NULL,
  label TEXT NOT NULL,
  api_key TEXT NOT NULL,
  model_default TEXT,
  daily_limit INTEGER NOT NULL DEFAULT 10000,
  daily_used INTEGER NOT NULL DEFAULT 0,
  total_used BIGINT NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL DEFAULT 'active',
  last_error TEXT,
  last_used_at TIMESTAMPTZ,
  last_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_keys_status_priority ON public.ai_provider_keys(status, priority) WHERE status = 'active';

ALTER TABLE public.ai_provider_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage ai keys"
ON public.ai_provider_keys FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- ============================================
-- 2. PLANOS DA API
-- ============================================
CREATE TABLE public.api_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price_brl NUMERIC(10,2) NOT NULL DEFAULT 0,
  daily_request_limit INTEGER NOT NULL DEFAULT 100,
  monthly_request_limit INTEGER NOT NULL DEFAULT 3000,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 10,
  models_allowed TEXT[] NOT NULL DEFAULT ARRAY['basic'],
  features JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.api_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans"
ON public.api_plans FOR SELECT TO authenticated
USING (is_active = true);

CREATE POLICY "Admins manage plans"
ON public.api_plans FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

INSERT INTO public.api_plans (slug, name, price_brl, daily_request_limit, monthly_request_limit, rate_limit_per_minute, models_allowed) VALUES
('free', 'Free', 0, 100, 3000, 10, ARRAY['basic']),
('pro', 'Pro', 19.90, 5000, 150000, 60, ARRAY['basic','advanced']),
('business', 'Business', 99.90, 50000, 1500000, 300, ARRAY['basic','advanced','premium']);

-- ============================================
-- 3. CHAVES DE CLIENTES
-- ============================================
CREATE TABLE public.api_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.api_plans(id),
  name TEXT NOT NULL DEFAULT 'Minha API Key',
  api_key TEXT NOT NULL UNIQUE,
  api_key_prefix TEXT NOT NULL,
  daily_used INTEGER NOT NULL DEFAULT 0,
  monthly_used INTEGER NOT NULL DEFAULT 0,
  total_used BIGINT NOT NULL DEFAULT 0,
  last_reset_daily TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_reset_monthly TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active',
  expires_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_api_clients_key ON public.api_clients(api_key) WHERE status = 'active';
CREATE INDEX idx_api_clients_user ON public.api_clients(user_id);

ALTER TABLE public.api_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own api clients"
ON public.api_clients FOR SELECT TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users create own api clients"
ON public.api_clients FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own api clients"
ON public.api_clients FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users delete own api clients"
ON public.api_clients FOR DELETE TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- ============================================
-- 4. LOGS DE USO
-- ============================================
CREATE TABLE public.api_usage_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  api_client_id UUID NOT NULL REFERENCES public.api_clients(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  provider_key_id UUID REFERENCES public.ai_provider_keys(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  model TEXT,
  endpoint TEXT NOT NULL DEFAULT '/v1/chat/completions',
  tokens_in INTEGER DEFAULT 0,
  tokens_out INTEGER DEFAULT 0,
  latency_ms INTEGER,
  status_code INTEGER NOT NULL,
  error_message TEXT,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_usage_logs_client_date ON public.api_usage_logs(api_client_id, created_at DESC);
CREATE INDEX idx_usage_logs_user_date ON public.api_usage_logs(user_id, created_at DESC);

ALTER TABLE public.api_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own usage logs"
ON public.api_usage_logs FOR SELECT TO authenticated
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role manages logs"
ON public.api_usage_logs FOR ALL TO public
USING ((SELECT auth.role()) = 'service_role')
WITH CHECK ((SELECT auth.role()) = 'service_role');

-- ============================================
-- 5. TRIGGERS
-- ============================================
CREATE TRIGGER update_ai_provider_keys_updated_at
BEFORE UPDATE ON public.ai_provider_keys
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_api_plans_updated_at
BEFORE UPDATE ON public.api_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_api_clients_updated_at
BEFORE UPDATE ON public.api_clients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 6. FUNÇÕES DE NEGÓCIO
-- ============================================
CREATE OR REPLACE FUNCTION public.get_next_ai_key(p_provider TEXT DEFAULT NULL)
RETURNS TABLE(id UUID, provider TEXT, api_key TEXT, model_default TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT k.id, k.provider, k.api_key, k.model_default
  FROM public.ai_provider_keys k
  WHERE k.status = 'active'
    AND k.daily_used < k.daily_limit
    AND (p_provider IS NULL OR k.provider = p_provider)
  ORDER BY k.priority ASC, k.daily_used ASC
  LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_ai_key_usage(p_key_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.ai_provider_keys
  SET daily_used = daily_used + 1,
      total_used = total_used + 1,
      last_used_at = now(),
      status = CASE WHEN daily_used + 1 >= daily_limit THEN 'exhausted' ELSE status END
  WHERE id = p_key_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_ai_key_error(p_key_id UUID, p_error TEXT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.ai_provider_keys
  SET status = 'error', last_error = p_error, updated_at = now()
  WHERE id = p_key_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_daily_ai_usage()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.ai_provider_keys
  SET daily_used = 0,
      last_reset_at = now(),
      status = CASE WHEN status IN ('exhausted','error') THEN 'active' ELSE status END,
      last_error = NULL
  WHERE last_reset_at < now() - interval '20 hours';

  UPDATE public.api_clients
  SET daily_used = 0, last_reset_daily = now()
  WHERE last_reset_daily < now() - interval '20 hours';
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_api_client(p_api_key TEXT)
RETURNS JSON LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_client public.api_clients%ROWTYPE;
  v_plan public.api_plans%ROWTYPE;
BEGIN
  SELECT * INTO v_client FROM public.api_clients WHERE api_key = p_api_key AND status = 'active';
  IF NOT FOUND THEN RETURN json_build_object('valid', false, 'reason', 'invalid_key'); END IF;
  IF v_client.expires_at IS NOT NULL AND v_client.expires_at < now() THEN
    RETURN json_build_object('valid', false, 'reason', 'expired');
  END IF;
  SELECT * INTO v_plan FROM public.api_plans WHERE id = v_client.plan_id;
  IF v_client.daily_used >= v_plan.daily_request_limit THEN
    RETURN json_build_object('valid', false, 'reason', 'daily_limit_reached');
  END IF;
  IF v_client.monthly_used >= v_plan.monthly_request_limit THEN
    RETURN json_build_object('valid', false, 'reason', 'monthly_limit_reached');
  END IF;
  RETURN json_build_object(
    'valid', true,
    'client_id', v_client.id,
    'user_id', v_client.user_id,
    'plan_slug', v_plan.slug,
    'models_allowed', v_plan.models_allowed,
    'daily_remaining', v_plan.daily_request_limit - v_client.daily_used
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_api_client_usage(p_client_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.api_clients
  SET daily_used = daily_used + 1,
      monthly_used = monthly_used + 1,
      total_used = total_used + 1,
      last_used_at = now()
  WHERE id = p_client_id;
END;
$$;
