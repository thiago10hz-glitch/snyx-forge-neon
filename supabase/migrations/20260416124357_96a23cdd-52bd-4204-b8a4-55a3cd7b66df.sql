
-- Drop the recursive policy
DROP POLICY IF EXISTS "Users can view partner profile" ON public.profiles;

-- Create a security definer function to get partner_user_id without triggering RLS
CREATE OR REPLACE FUNCTION public.get_partner_user_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT partner_user_id FROM profiles WHERE user_id = _user_id LIMIT 1;
$$;

-- Recreate the policy using the function (no recursion)
CREATE POLICY "Users can view partner profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = public.get_partner_user_id(auth.uid())
);
