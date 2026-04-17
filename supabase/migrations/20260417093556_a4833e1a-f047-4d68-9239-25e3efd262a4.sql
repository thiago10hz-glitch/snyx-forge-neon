DROP FUNCTION IF EXISTS public.activate_accelerator_key(text) CASCADE;
DROP FUNCTION IF EXISTS public.generate_accelerator_key(integer) CASCADE;
DROP FUNCTION IF EXISTS public.get_my_vpn_config() CASCADE;
DROP TABLE IF EXISTS public.vpn_peers CASCADE;
DROP TABLE IF EXISTS public.vpn_server_config CASCADE;
DROP TABLE IF EXISTS public.accelerator_keys CASCADE;