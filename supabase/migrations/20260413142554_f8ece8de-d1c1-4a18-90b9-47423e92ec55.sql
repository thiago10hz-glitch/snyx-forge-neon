
-- Fix 1: Restrict users from updating privilege fields on their own profile
-- Drop the existing permissive user UPDATE policy
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Recreate with WITH CHECK that prevents users from changing privilege fields
-- Users can update their own profile, but only if they don't change privilege columns
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND is_vip = (SELECT p.is_vip FROM public.profiles p WHERE p.user_id = auth.uid())
  AND is_dev = (SELECT p.is_dev FROM public.profiles p WHERE p.user_id = auth.uid())
  AND vip_expires_at IS NOT DISTINCT FROM (SELECT p.vip_expires_at FROM public.profiles p WHERE p.user_id = auth.uid())
  AND dev_expires_at IS NOT DISTINCT FROM (SELECT p.dev_expires_at FROM public.profiles p WHERE p.user_id = auth.uid())
  AND banned_until IS NOT DISTINCT FROM (SELECT p.banned_until FROM public.profiles p WHERE p.user_id = auth.uid())
  AND free_messages_used = (SELECT p.free_messages_used FROM public.profiles p WHERE p.user_id = auth.uid())
  AND last_free_message_at IS NOT DISTINCT FROM (SELECT p.last_free_message_at FROM public.profiles p WHERE p.user_id = auth.uid())
  AND ip_address IS NOT DISTINCT FROM (SELECT p.ip_address FROM public.profiles p WHERE p.user_id = auth.uid())
  AND device_fingerprint IS NOT DISTINCT FROM (SELECT p.device_fingerprint FROM public.profiles p WHERE p.user_id = auth.uid())
);

-- Fix 2: Add explicit admin-only INSERT and DELETE policies on user_roles
CREATE POLICY "Admins can insert roles" ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete roles" ON public.user_roles
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update roles" ON public.user_roles
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));
