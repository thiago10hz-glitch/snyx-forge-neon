ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_rpg_premium boolean NOT NULL DEFAULT false;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rpg_premium_expires_at timestamptz DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.admin_grant_rpg_premium(p_target_user_id uuid, p_months integer)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Não autorizado');
  END IF;
  UPDATE profiles SET is_rpg_premium = true, rpg_premium_expires_at = now() + (p_months || ' months')::interval WHERE user_id = p_target_user_id;
  RETURN json_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_rpg_premium(p_target_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Não autorizado');
  END IF;
  UPDATE profiles SET is_rpg_premium = false, rpg_premium_expires_at = NULL WHERE user_id = p_target_user_id;
  RETURN json_build_object('success', true);
END;
$$;