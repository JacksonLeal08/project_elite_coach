'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { Send, MessageSquare, Loader2 } from 'lucide-react';

interface ChatComponentProps {
  studentId: string;
  coachId: string;
  senderId: string;
  senderName: string;
  isPublic?: boolean;
}

interface Message {
  id: string;
  created_at: string;
  room_id: string;
  sender_id: string;
  message: string;
  read: boolean;
}

export default function ChatComponent({
  studentId,
  coachId,
  senderId,
  senderName,
  isPublic = false,
}: ChatComponentProps) {
  const [roomId, setRoomId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 1. Obter ou Criar a Sala de Chat
  useEffect(() => {
    const initChatRoom = async () => {
      if (!studentId || !coachId) return;
      setLoading(true);
      try {
        // Tenta buscar sala existente
        const { data, error } = await supabase
          .from('chat_rooms')
          .select('id')
          .eq('student_id', studentId)
          .eq('coach_id', coachId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setRoomId(data.id);
        } else {
          // Cria nova sala se não existir
          const { data: newRoom, error: createError } = await supabase
            .from('chat_rooms')
            .insert({ student_id: studentId, coach_id: coachId })
            .select('id')
            .single();

          if (createError) throw createError;
          if (newRoom) setRoomId(newRoom.id);
        }
      } catch (err) {
        console.error('Erro ao inicializar sala de chat:', err);
      }
    };

    initChatRoom();
  }, [studentId, coachId]);

  // 2. Carregar Histórico de Mensagens e Assinar Realtime
  useEffect(() => {
    if (!roomId) return;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from('chat_messages')
          .select('*')
          .eq('room_id', roomId)
          .order('created_at', { ascending: true });

        if (error) throw error;
        setMessages(data || []);
      } catch (err) {
        console.error('Erro ao carregar mensagens:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();

    // Assinar canal Realtime para escutar novas mensagens inseridas
    const channel = supabase
      .channel(`chat:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            // Evita duplicados
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // 3. Scroll Automático para o Fim
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // 4. Enviar Mensagem
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !roomId || sending) return;

    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');

    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: senderId,
          message: text,
        });

      if (error) throw error;
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      setNewMessage(text); // Restaura o texto em caso de falha
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-zinc-400 gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="text-xs">Iniciando chat...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface-container/60 border border-surface-highest/40 rounded-xl overflow-hidden shadow-inner">
      {/* Messages Timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[300px] max-h-[450px] scrollbar-none">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-zinc-500 gap-2 text-center px-4">
            <MessageSquare className="w-8 h-8 text-zinc-600 animate-pulse" />
            <p className="text-xs font-semibold uppercase tracking-wider">Nenhuma mensagem ainda</p>
            <p className="text-[10px] max-w-[200px] leading-relaxed">Envie uma mensagem abaixo para iniciar a conversa.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === senderId;
            return (
              <div
                key={msg.id}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-xs shadow-md ${
                    isMe
                      ? 'bg-primary text-black rounded-tr-none'
                      : 'bg-surface-high border border-surface-highest text-white rounded-tl-none'
                  }`}
                >
                  <p className="break-words leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                  <span
                    className={`block text-[7.5px] mt-1 font-mono text-right ${
                      isMe ? 'text-black/60' : 'text-zinc-500'
                    }`}
                  >
                    {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={handleSendMessage}
        className="p-3 bg-surface/50 border-t border-surface-highest/60 flex gap-2 items-center"
      >
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Digite sua mensagem..."
          className="flex-1 bg-surface-high text-white text-xs px-4 py-2.5 rounded-lg border border-surface-highest/65 focus:border-primary/50 focus:outline-none placeholder-zinc-500"
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || sending}
          className="w-9 h-9 shrink-0 rounded-lg bg-primary text-black flex items-center justify-center hover:bg-primary-dim active:scale-95 disabled:opacity-50 transition-all shadow-md"
        >
          {sending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </form>
    </div>
  );
}
