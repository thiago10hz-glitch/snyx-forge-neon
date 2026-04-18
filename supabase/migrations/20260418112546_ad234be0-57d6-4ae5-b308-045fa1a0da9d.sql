-- 1. Atualiza plano Free existente (se houver) para usar snyx-fast
UPDATE public.api_plans
SET 
  models_allowed = ARRAY['snyx-fast'],
  daily_request_limit = 100,
  monthly_request_limit = 2000,
  rate_limit_per_minute = 10,
  features = '{"description": "Para testar a API SnyX. Modelo rápido, ideal para protótipos."}'::jsonb,
  updated_at = now()
WHERE slug = 'free';

-- 2. Insere plano Free se não existir
INSERT INTO public.api_plans (slug, name, price_brl, daily_request_limit, monthly_request_limit, rate_limit_per_minute, models_allowed, is_active, features)
SELECT 'free', 'Free', 0, 100, 2000, 10, ARRAY['snyx-fast'], true, '{"description": "Para testar a API SnyX. Modelo rápido, ideal para protótipos."}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.api_plans WHERE slug = 'free');

-- 3. Starter R$ 19/mês
INSERT INTO public.api_plans (slug, name, price_brl, daily_request_limit, monthly_request_limit, rate_limit_per_minute, models_allowed, is_active, features)
VALUES (
  'starter', 'Starter', 19.00, 1000, 20000, 30,
  ARRAY['snyx-fast', 'snyx-pro', 'snyx-coder'],
  true,
  '{"description": "Para devs que estão começando a vender. 3 modelos, 1k req/dia.", "highlight": false}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_brl = EXCLUDED.price_brl,
  daily_request_limit = EXCLUDED.daily_request_limit,
  monthly_request_limit = EXCLUDED.monthly_request_limit,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  models_allowed = EXCLUDED.models_allowed,
  features = EXCLUDED.features,
  is_active = true,
  updated_at = now();

-- 4. Pro R$ 49/mês
INSERT INTO public.api_plans (slug, name, price_brl, daily_request_limit, monthly_request_limit, rate_limit_per_minute, models_allowed, is_active, features)
VALUES (
  'pro', 'Pro', 49.00, 10000, 250000, 100,
  ARRAY['snyx-fast', 'snyx-pro', 'snyx-coder', 'snyx-reasoning', 'snyx-search'],
  true,
  '{"description": "Para apps em produção. 5 modelos premium, 10k req/dia.", "highlight": true, "tag": "Mais popular"}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_brl = EXCLUDED.price_brl,
  daily_request_limit = EXCLUDED.daily_request_limit,
  monthly_request_limit = EXCLUDED.monthly_request_limit,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  models_allowed = EXCLUDED.models_allowed,
  features = EXCLUDED.features,
  is_active = true,
  updated_at = now();

-- 5. Business R$ 149/mês
INSERT INTO public.api_plans (slug, name, price_brl, daily_request_limit, monthly_request_limit, rate_limit_per_minute, models_allowed, is_active, features)
VALUES (
  'business', 'Business', 149.00, 50000, 1500000, 300,
  ARRAY['snyx-fast', 'snyx-pro', 'snyx-coder', 'snyx-reasoning', 'snyx-vision', 'snyx-search'],
  true,
  '{"description": "Para empresas e SaaS. Todos os modelos, 50k req/dia, suporte prioritário.", "highlight": false}'::jsonb
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  price_brl = EXCLUDED.price_brl,
  daily_request_limit = EXCLUDED.daily_request_limit,
  monthly_request_limit = EXCLUDED.monthly_request_limit,
  rate_limit_per_minute = EXCLUDED.rate_limit_per_minute,
  models_allowed = EXCLUDED.models_allowed,
  features = EXCLUDED.features,
  is_active = true,
  updated_at = now();

-- 6. Desativa planos antigos que não estão na lista nova
UPDATE public.api_plans
SET is_active = false, updated_at = now()
WHERE slug NOT IN ('free', 'starter', 'pro', 'business');