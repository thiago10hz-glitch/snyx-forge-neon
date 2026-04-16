
CREATE TABLE public.fraud_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  attempt_type TEXT NOT NULL DEFAULT 'payment_tamper',
  details TEXT,
  warning_shown BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.fraud_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage fraud attempts"
ON public.fraud_attempts
FOR ALL
USING ((SELECT auth.role()) = 'service_role')
WITH CHECK ((SELECT auth.role()) = 'service_role');

CREATE POLICY "Users can view own fraud attempts"
ON public.fraud_attempts
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all fraud attempts"
ON public.fraud_attempts
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_fraud_attempts_user ON public.fraud_attempts (user_id, created_at DESC);
