
-- Add partner_user_id to profiles
ALTER TABLE public.profiles ADD COLUMN partner_user_id uuid DEFAULT NULL;

-- Function to link two users as partners (admin only, sets both sides)
CREATE OR REPLACE FUNCTION public.admin_set_partner(p_user1_id uuid, p_user2_id uuid)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Não autorizado');
  END IF;

  -- Set both sides
  UPDATE profiles SET partner_user_id = p_user2_id, relationship_status = 'namorando' WHERE user_id = p_user1_id;
  UPDATE profiles SET partner_user_id = p_user1_id, relationship_status = 'namorando' WHERE user_id = p_user2_id;

  RETURN json_build_object('success', true);
END;
$$;
