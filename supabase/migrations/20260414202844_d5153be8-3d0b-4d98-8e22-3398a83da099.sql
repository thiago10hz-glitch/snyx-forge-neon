
CREATE OR REPLACE FUNCTION public.increment_character_chat_count(p_character_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE ai_characters SET chat_count = chat_count + 1 WHERE id = p_character_id;
END;
$$;
