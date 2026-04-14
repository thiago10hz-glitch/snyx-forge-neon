
-- Add team_badge column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS team_badge text DEFAULT NULL;

-- Function to validate display_name changes - block "SnyX" suffix for non-team members
CREATE OR REPLACE FUNCTION public.validate_display_name()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if display_name ends with "SnyX" (case-insensitive)
  IF NEW.display_name IS NOT NULL AND lower(trim(NEW.display_name)) LIKE '%snyx' THEN
    -- Only allow if user has a team_badge set
    -- For new inserts, check the NEW record; for updates, check if badge is being set or already exists
    IF NEW.team_badge IS NULL THEN
      RAISE EXCEPTION 'O sufixo SnyX é restrito à equipe. Somente admins podem autorizar.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on profiles
DROP TRIGGER IF EXISTS check_display_name_snyx ON public.profiles;
CREATE TRIGGER check_display_name_snyx
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_display_name();

-- Function for admins to grant/revoke team badge
CREATE OR REPLACE FUNCTION public.admin_set_team_badge(p_user_id uuid, p_badge text DEFAULT NULL)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Não autorizado');
  END IF;
  UPDATE profiles SET team_badge = p_badge WHERE user_id = p_user_id;
  RETURN json_build_object('success', true, 'badge', p_badge);
END;
$$;
