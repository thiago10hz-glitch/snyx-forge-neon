DROP TABLE IF EXISTS public.chat_shared_messages CASCADE;
DROP TABLE IF EXISTS public.chat_shared_rooms CASCADE;
DROP TABLE IF EXISTS public.chat_connections CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.rpg_player_characters CASCADE;
DROP TABLE IF EXISTS public.voice_call_history CASCADE;
DROP TABLE IF EXISTS public.app_releases CASCADE;
DROP FUNCTION IF EXISTS public.has_active_subscription(uuid, text) CASCADE;