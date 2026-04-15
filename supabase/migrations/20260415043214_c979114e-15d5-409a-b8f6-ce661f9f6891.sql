
CREATE OR REPLACE FUNCTION public.activate_accelerator_key(p_key text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key accelerator_keys%ROWTYPE;
BEGIN
  -- First check if key exists at all
  SELECT * INTO v_key FROM accelerator_keys WHERE activation_key = p_key;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Chave inválida ou já utilizada');
  END IF;

  -- If key is already active and belongs to this user, return success
  IF v_key.status = 'active' AND v_key.activated_by = auth.uid() THEN
    RETURN json_build_object('success', true, 'message', 'Chave já está ativa na sua conta!');
  END IF;

  -- If key is active but belongs to someone else
  IF v_key.status = 'active' THEN
    RETURN json_build_object('success', false, 'error', 'Chave já foi utilizada por outro usuário');
  END IF;

  -- If key is revoked
  IF v_key.status = 'revoked' THEN
    RETURN json_build_object('success', false, 'error', 'Chave foi revogada');
  END IF;

  -- Only available keys from here
  IF v_key.status != 'available' THEN
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
$function$;
