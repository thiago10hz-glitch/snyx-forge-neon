
-- Function to find user by email (security definer to access auth.users)
CREATE OR REPLACE FUNCTION public.find_user_by_email(p_email text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users WHERE email = p_email LIMIT 1;
$$;

-- Function to revoke hosting from a user (admin only)
CREATE OR REPLACE FUNCTION public.admin_revoke_hosting(p_user_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Não autorizado');
  END IF;
  UPDATE profiles SET hosting_tier = 'none' WHERE user_id = p_user_id;
  RETURN json_build_object('success', true);
END;
$$;
