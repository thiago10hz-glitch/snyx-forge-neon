-- Unban user wrongly suspended by outdated price validation
UPDATE public.profiles 
SET banned_until = NULL 
WHERE user_id = '7721b99c-4efb-4162-a434-0b426331c092' 
  AND banned_until IS NOT NULL 
  AND banned_until > now() 
  AND banned_until < now() + interval '2 hours';

-- Clear recent fraud attempts caused by stale price list
DELETE FROM public.fraud_attempts 
WHERE user_id = '7721b99c-4efb-4162-a434-0b426331c092' 
  AND created_at > now() - interval '1 day';