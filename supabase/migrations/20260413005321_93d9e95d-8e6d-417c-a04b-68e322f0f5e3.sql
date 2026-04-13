-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  relationship_status TEXT,
  is_vip BOOLEAN NOT NULL DEFAULT false,
  is_dev BOOLEAN NOT NULL DEFAULT false,
  free_messages_used INTEGER NOT NULL DEFAULT 0,
  last_free_message_at TIMESTAMPTZ,
  banned_until TIMESTAMPTZ,
  ip_address TEXT,
  device_fingerprint TEXT,
  vip_expires_at TIMESTAMPTZ,
  dev_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- Create admin_presence table
CREATE TABLE public.admin_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create chat_conversations table
CREATE TABLE public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Nova conversa',
  mode TEXT NOT NULL DEFAULT 'friend',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create chat_messages table
CREATE TABLE public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create chat_customization table
CREATE TABLE public.chat_customization (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  theme_color TEXT,
  bg_color TEXT,
  ai_name TEXT,
  ai_avatar_url TEXT,
  ai_personality TEXT,
  system_prompt TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create license_keys table
CREATE TABLE public.license_keys (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key_code TEXT NOT NULL UNIQUE,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_by_user_id UUID,
  used_by_email TEXT,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create support_tickets table
CREATE TABLE public.support_tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  admin_id UUID,
  subject TEXT NOT NULL DEFAULT 'Suporte',
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create support_messages table
CREATE TABLE public.support_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  sender_role TEXT NOT NULL DEFAULT 'user',
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_customization ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.license_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;

-- has_role function (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- can_send_message function
CREATE OR REPLACE FUNCTION public.can_send_message()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
     AND v_profile.free_messages_used >= 15 THEN
    RETURN json_build_object('allowed', false, 'reason', 'limit_reached', 'remaining', 0, 'reset_at', v_profile.last_free_message_at + interval '24 hours');
  END IF;
  IF v_profile.last_free_message_at IS NULL OR v_profile.last_free_message_at < now() - interval '24 hours' THEN
    RETURN json_build_object('allowed', true, 'remaining', 15, 'is_vip', false);
  END IF;
  RETURN json_build_object('allowed', true, 'remaining', 15 - v_profile.free_messages_used, 'is_vip', false);
END;
$$;

-- increment_free_messages function
CREATE OR REPLACE FUNCTION public.increment_free_messages()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE user_id = auth.uid();
  IF v_profile.last_free_message_at IS NULL OR v_profile.last_free_message_at < now() - interval '24 hours' THEN
    UPDATE profiles SET free_messages_used = 1, last_free_message_at = now() WHERE user_id = auth.uid();
  ELSE
    UPDATE profiles SET free_messages_used = free_messages_used + 1 WHERE user_id = auth.uid();
  END IF;
END;
$$;

-- check_fingerprint function
CREATE OR REPLACE FUNCTION public.check_fingerprint(p_fingerprint TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE device_fingerprint = p_fingerprint AND user_id != auth.uid()) THEN
    RETURN json_build_object('duplicate', true);
  END IF;
  UPDATE profiles SET device_fingerprint = p_fingerprint WHERE user_id = auth.uid();
  RETURN json_build_object('duplicate', false);
END;
$$;

-- check_ip_duplicate function
CREATE OR REPLACE FUNCTION public.check_ip_duplicate(p_ip TEXT, p_user_id UUID DEFAULT NULL)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM profiles WHERE ip_address = p_ip AND user_id != COALESCE(p_user_id, auth.uid())) THEN
    RETURN json_build_object('duplicate', true);
  END IF;
  UPDATE profiles SET ip_address = p_ip WHERE user_id = COALESCE(p_user_id, auth.uid());
  RETURN json_build_object('duplicate', false);
END;
$$;

-- redeem_license_key function
CREATE OR REPLACE FUNCTION public.redeem_license_key(p_key_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key license_keys%ROWTYPE;
BEGIN
  SELECT * INTO v_key FROM license_keys WHERE key_code = p_key_code;
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Chave não encontrada');
  END IF;
  IF v_key.is_used THEN
    RETURN json_build_object('success', false, 'error', 'Chave já utilizada');
  END IF;
  UPDATE license_keys SET is_used = true, used_by_user_id = auth.uid(), used_by_email = (SELECT email FROM auth.users WHERE id = auth.uid()), used_at = now() WHERE id = v_key.id;
  UPDATE profiles SET is_vip = true, vip_expires_at = now() + interval '30 days' WHERE user_id = auth.uid();
  RETURN json_build_object('success', true);
END;
$$;

-- admin_grant_vip function
CREATE OR REPLACE FUNCTION public.admin_grant_vip(p_target_user_id UUID, p_months INTEGER)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Não autorizado');
  END IF;
  UPDATE profiles SET is_vip = true, vip_expires_at = now() + (p_months || ' months')::interval WHERE user_id = p_target_user_id;
  RETURN json_build_object('success', true);
END;
$$;

-- admin_revoke_vip function
CREATE OR REPLACE FUNCTION public.admin_revoke_vip(p_target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RETURN json_build_object('success', false, 'error', 'Não autorizado');
  END IF;
  UPDATE profiles SET is_vip = false, vip_expires_at = NULL WHERE user_id = p_target_user_id;
  RETURN json_build_object('success', true);
END;
$$;

-- admin_force_set_dev function
CREATE OR REPLACE FUNCTION public.admin_force_set_dev(p_user_id UUID, p_is_dev BOOLEAN, p_expires_at TIMESTAMPTZ DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Não autorizado';
  END IF;
  UPDATE profiles SET is_dev = p_is_dev, dev_expires_at = p_expires_at WHERE user_id = p_user_id;
END;
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- user_roles policies
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);

-- admin_presence policies
CREATE POLICY "Anyone can view admin presence" ON public.admin_presence FOR SELECT USING (true);
CREATE POLICY "Admins can upsert presence" ON public.admin_presence FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update presence" ON public.admin_presence FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- chat_conversations policies
CREATE POLICY "Users can view own conversations" ON public.chat_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create conversations" ON public.chat_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON public.chat_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON public.chat_conversations FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all conversations" ON public.chat_conversations FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- chat_messages policies
CREATE POLICY "Users can view own messages" ON public.chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM chat_conversations WHERE id = conversation_id AND user_id = auth.uid())
);
CREATE POLICY "Users can create messages" ON public.chat_messages FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM chat_conversations WHERE id = conversation_id AND user_id = auth.uid())
);
CREATE POLICY "Users can delete own messages" ON public.chat_messages FOR DELETE USING (
  EXISTS (SELECT 1 FROM chat_conversations WHERE id = conversation_id AND user_id = auth.uid())
);
CREATE POLICY "Admins can view all messages" ON public.chat_messages FOR SELECT USING (has_role(auth.uid(), 'admin'));

-- chat_customization policies
CREATE POLICY "Users can view own customization" ON public.chat_customization FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own customization" ON public.chat_customization FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own customization" ON public.chat_customization FOR UPDATE USING (auth.uid() = user_id);

-- license_keys policies
CREATE POLICY "Authenticated users can view keys" ON public.license_keys FOR SELECT TO authenticated USING (true);

-- support_tickets policies
CREATE POLICY "Users can view own tickets" ON public.support_tickets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create tickets" ON public.support_tickets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tickets" ON public.support_tickets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all tickets" ON public.support_tickets FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update all tickets" ON public.support_tickets FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- support_messages policies
CREATE POLICY "Users can view own ticket messages" ON public.support_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM support_tickets WHERE id = ticket_id AND user_id = auth.uid())
);
CREATE POLICY "Users can send messages" ON public.support_messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Admins can view all support messages" ON public.support_messages FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can send support messages" ON public.support_messages FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));

-- Auto-create profile on signup trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Avatars storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update their own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE admin_presence;
ALTER PUBLICATION supabase_realtime ADD TABLE support_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE support_tickets;