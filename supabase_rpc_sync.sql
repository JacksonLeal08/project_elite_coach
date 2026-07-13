-- Script SQL para criar a função RPC no Supabase
-- Execute este script no SQL Editor do painel do seu Supabase.

CREATE OR REPLACE FUNCTION public.sync_profile_by_email(
  p_email text,
  p_name text,
  p_role text,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER -- Permite acessar a tabela auth.users e public.profiles com privilégios de administrador
AS $$
DECLARE
  v_user_id uuid;
  v_username text;
BEGIN
  -- 1. Buscar o ID do usuário correspondente ao e-mail na tabela auth.users
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = p_email
  LIMIT 1;

  -- 2. Se o usuário não existir no Supabase Auth, retorna erro
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'E-mail não encontrado na tabela de autenticação do Supabase (auth.users).'
    );
  END IF;

  -- 3. Gerar um username padrão a partir da primeira parte do e-mail
  v_username := lower(split_part(p_email, '@', 1));

  -- 4. Inserir ou atualizar na tabela public.profiles
  INSERT INTO public.profiles (
    id, 
    name, 
    email, 
    role, 
    unremovable, 
    expires_at, 
    username
  )
  VALUES (
    v_user_id,
    p_name,
    p_email,
    p_role,
    false,
    p_expires_at,
    v_username
  )
  ON CONFLICT (id) 
  DO UPDATE SET
    name = EXCLUDED.name,
    role = EXCLUDED.role,
    expires_at = EXCLUDED.expires_at,
    username = COALESCE(profiles.username, EXCLUDED.username);

  -- Retorna sucesso
  RETURN jsonb_build_object('success', true);

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', SQLERRM
    );
END;
$$;
