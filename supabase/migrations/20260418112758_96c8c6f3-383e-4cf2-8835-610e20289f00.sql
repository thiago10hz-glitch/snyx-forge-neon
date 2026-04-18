CREATE OR REPLACE FUNCTION public.admin_revoke_api_client(p_client_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Não autorizado');
  END IF;
  UPDATE public.api_clients SET status = 'revoked', updated_at = now() WHERE id = p_client_id;
  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reset_api_client_usage(p_client_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Não autorizado');
  END IF;
  UPDATE public.api_clients
  SET daily_used = 0, monthly_used = 0, last_reset_daily = now(), last_reset_monthly = now(), updated_at = now()
  WHERE id = p_client_id;
  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_delete_api_client(p_client_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Não autorizado');
  END IF;
  SELECT user_id INTO v_user_id FROM public.api_clients WHERE id = p_client_id;
  -- Apaga logs primeiro (FK)
  DELETE FROM public.api_usage_logs WHERE api_client_id = p_client_id;
  DELETE FROM public.api_clients WHERE id = p_client_id;
  RETURN json_build_object('success', true, 'deleted_user_id', v_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reactivate_api_client(p_client_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Não autorizado');
  END IF;
  UPDATE public.api_clients SET status = 'active', updated_at = now() WHERE id = p_client_id;
  RETURN json_build_object('success', true);
END;
$$;