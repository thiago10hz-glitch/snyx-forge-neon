CREATE OR REPLACE FUNCTION public.redeem_license_key(p_key_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_key license_keys%ROWTYPE;
  v_tier text;
BEGIN
  SELECT * INTO v_key FROM license_keys WHERE key_code = p_key_code;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Chave não encontrada');
  END IF;
  IF v_key.is_used THEN
    RETURN json_build_object('success', false, 'error', 'Chave já utilizada');
  END IF;

  UPDATE license_keys SET is_used = true, used_by_user_id = auth.uid(), used_by_email = (SELECT email FROM auth.users WHERE id = auth.uid()), used_at = now() WHERE id = v_key.id;

  -- Check if it's a hosting key
  IF p_key_code LIKE 'HOST-%' THEN
    -- Extract tier from key code (HOST-BASIC-xxx, HOST-PRO-xxx, HOST-UNLIMITED-xxx)
    v_tier := lower(split_part(p_key_code, '-', 2));
    IF v_tier NOT IN ('basic', 'pro', 'unlimited') THEN
      v_tier := 'basic';
    END IF;
    UPDATE profiles SET hosting_tier = v_tier WHERE user_id = auth.uid();
    RETURN json_build_object('success', true, 'type', 'hosting', 'tier', v_tier);
  ELSE
    -- Regular VIP key
    UPDATE profiles SET is_vip = true, vip_expires_at = now() + interval '30 days' WHERE user_id = auth.uid();
    RETURN json_build_object('success', true, 'type', 'vip');
  END IF;
END;
$function$;