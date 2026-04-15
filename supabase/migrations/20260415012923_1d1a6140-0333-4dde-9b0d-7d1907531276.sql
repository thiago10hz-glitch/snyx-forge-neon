-- Table for accelerator activation keys
CREATE TABLE public.accelerator_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activation_key text NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  activated_by uuid,
  activated_at timestamptz,
  status text NOT NULL DEFAULT 'available',
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.accelerator_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage accelerator keys"
  ON public.accelerator_keys FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own activated key"
  ON public.accelerator_keys FOR SELECT TO authenticated
  USING (activated_by = auth.uid());

CREATE OR REPLACE FUNCTION public.activate_accelerator_key(p_key text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key accelerator_keys%ROWTYPE;
BEGIN
  SELECT * INTO v_key FROM accelerator_keys WHERE activation_key = p_key AND status = 'available';
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Chave inválida ou já utilizada');
  END IF;

  IF v_key.expires_at IS NOT NULL AND v_key.expires_at < now() THEN
    RETURN json_build_object('success', false, 'error', 'Chave expirada');
  END IF;

  IF EXISTS (SELECT 1 FROM accelerator_keys WHERE activated_by = auth.uid() AND status = 'active') THEN
    RETURN json_build_object('success', false, 'error', 'Você já possui uma chave ativa');
  END IF;

  UPDATE accelerator_keys 
  SET activated_by = auth.uid(), activated_at = now(), status = 'active', updated_at = now()
  WHERE id = v_key.id;

  RETURN json_build_object('success', true, 'message', 'Accelerator ativado com sucesso!');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_accelerator_key(p_expires_months int DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_key text;
  v_expires timestamptz;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Não autorizado');
  END IF;

  v_key := 'SNYX-ACC-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 4)) || '-' || upper(substr(md5(random()::text), 1, 4)) || '-' || upper(substr(md5(clock_timestamp()::text), 1, 4));
  
  IF p_expires_months IS NOT NULL THEN
    v_expires := now() + (p_expires_months || ' months')::interval;
  END IF;

  INSERT INTO accelerator_keys (activation_key, created_by, expires_at)
  VALUES (v_key, auth.uid(), v_expires);

  RETURN json_build_object('success', true, 'key', v_key);
END;
$$;