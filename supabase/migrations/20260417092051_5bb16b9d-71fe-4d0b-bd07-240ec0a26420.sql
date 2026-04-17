CREATE OR REPLACE FUNCTION public.can_send_message()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_profile profiles%ROWTYPE;
  v_is_admin BOOLEAN;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE user_id = auth.uid();
  IF NOT FOUND THEN
    RETURN json_build_object('allowed', false, 'reason', 'no_profile');
  END IF;
  IF v_profile.banned_until IS NOT NULL AND v_profile.banned_until > now() THEN
    RETURN json_build_object('allowed', false, 'reason', 'banned', 'banned_until', v_profile.banned_until);
  END IF;
  SELECT has_role(auth.uid(), 'admin') INTO v_is_admin;
  IF v_is_admin OR v_profile.is_vip OR v_profile.is_dev THEN
    RETURN json_build_object('allowed', true, 'is_vip', true);
  END IF;
  IF v_profile.last_free_message_at IS NOT NULL 
     AND v_profile.last_free_message_at > now() - interval '24 hours'
     AND v_profile.free_messages_used >= 5 THEN
    RETURN json_build_object('allowed', false, 'reason', 'limit_reached', 'remaining', 0, 'reset_at', v_profile.last_free_message_at + interval '24 hours');
  END IF;
  IF v_profile.last_free_message_at IS NULL OR v_profile.last_free_message_at < now() - interval '24 hours' THEN
    RETURN json_build_object('allowed', true, 'remaining', 5, 'is_vip', false);
  END IF;
  RETURN json_build_object('allowed', true, 'remaining', 5 - v_profile.free_messages_used, 'is_vip', false);
END;
$function$;