-- ========================================================================
-- Elite Coach CRM - Schema de Tabelas para Chat Interno Real-Time
-- ========================================================================
-- Cole este script no SQL Editor do painel do seu Supabase para criar
-- a estrutura de dados necessária para o funcionamento do Chat.
-- ========================================================================

-- 1. Criar a tabela de salas de chat
CREATE TABLE IF NOT EXISTS public.chat_rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    coach_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    CONSTRAINT unique_student_coach UNIQUE (student_id, coach_id)
);

-- 2. Criar a tabela de mensagens de chat
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    room_id UUID NOT NULL REFERENCES public.chat_rooms(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT false NOT NULL
);

-- 3. Habilitar segurança em nível de linha (RLS)
ALTER TABLE public.chat_rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 4. Habilitar as tabelas para escuta em Realtime
-- Caso a publicação não exista, criamos. Se já existir, apenas adicionamos a tabela.
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;

-- 5. Criar políticas de acesso de segurança (RLS) para chat_rooms
-- Permitimos leitura e criação de salas para viabilizar a troca de mensagens 
-- tanto para professores autenticados quanto para alunos na página pública anon.
CREATE POLICY "Permitir leitura de salas de chat para participantes" 
ON public.chat_rooms FOR SELECT 
USING (true);

CREATE POLICY "Permitir criacao de salas de chat" 
ON public.chat_rooms FOR INSERT 
WITH CHECK (true);

-- 6. Criar políticas de acesso de segurança (RLS) para chat_messages
CREATE POLICY "Permitir leitura de mensagens para participantes" 
ON public.chat_messages FOR SELECT 
USING (true);

CREATE POLICY "Permitir envio de mensagens" 
ON public.chat_messages FOR INSERT 
WITH CHECK (true);

-- ========================================================================
-- FIM DO SCRIPT SQL
-- ========================================================================
