DROP FUNCTION IF EXISTS public.admin_revoke_hosting(uuid) CASCADE;
DROP FUNCTION IF EXISTS public.check_hosting_limit() CASCADE;
DROP FUNCTION IF EXISTS public.can_use_demo(text, text) CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_demos() CASCADE;
DROP TABLE IF EXISTS public.hosted_sites CASCADE;
DROP TABLE IF EXISTS public.clone_demos CASCADE;
DROP TABLE IF EXISTS public.video_generations CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS hosting_tier;