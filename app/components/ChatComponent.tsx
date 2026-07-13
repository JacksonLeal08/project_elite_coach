'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { Send, MessageSquare, Loader2, Share2, Image, Mic, Star, Sparkles } from 'lucide-react';

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
  message_type?: 'text' | 'image' | 'audio';
  reactions?: Record<string, string[]>;
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

  // Advanced features states
  const [chatRating, setChatRating] = useState<number | null>(null);
  const [chatFeedback, setChatFeedback] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Play synthetic premium ding sound on new messages
  const playNotificationSound = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.08); // A5
      
      gain.gain.setValueAtTime(0.06, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
      
      osc.start(audioCtx.currentTime);
      osc.stop(audioCtx.currentTime + 0.12);
    } catch (err) {
      console.warn('AudioContext failed:', err);
    }
  };

  // 1. Obter ou Criar a Sala de Chat
  useEffect(() => {
    const initChatRoom = async () => {
      if (!studentId || !coachId) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('chat_rooms')
          .select('id, rating, rating_feedback')
          .eq('student_id', studentId)
          .eq('coach_id', coachId)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setRoomId(data.id);
          setChatRating(data.rating);
          setChatFeedback(data.rating_feedback);
        } else {
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

    // Live subscription for INSERT and UPDATE events
    const channel = supabase
      .channel(`chat:${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          if (newMsg && newMsg.room_id === roomId) {
            if (payload.eventType === 'INSERT') {
              setMessages((prev) => {
                if (prev.some((m) => m.id === newMsg.id)) return prev;
                if (newMsg.sender_id !== senderId) {
                  playNotificationSound();
                }
                return [...prev, newMsg];
              });
            } else if (payload.eventType === 'UPDATE') {
              setMessages((prev) =>
                prev.map((m) => (m.id === newMsg.id ? newMsg : m))
              );
            }
          }
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

  // 4. Gravação de Áudio com Fallback Base64
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());

        setSending(true);
        try {
          const fileName = `${roomId}/voice_${Date.now()}.webm`;
          
          const { data, error } = await supabase.storage
            .from('chat-attachments')
            .upload(fileName, audioBlob, { contentType: 'audio/webm' });

          if (error) {
            console.warn('Storage error, fallback to base64 voice note:', error);
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
              const base64data = reader.result as string;
              await sendAttachmentMessage(base64data, 'audio');
            };
          } else if (data) {
            const { data: urlData } = supabase.storage
              .from('chat-attachments')
              .getPublicUrl(fileName);
            await sendAttachmentMessage(urlData.publicUrl, 'audio');
          }
        } catch (err) {
          console.error(err);
        } finally {
          setSending(false);
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error(err);
      alert('Não foi possível acessar o microfone. Verifique as permissões.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // 5. Envio de Imagem
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomId || sending) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem válida!');
      return;
    }

    setSending(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${roomId}/img_${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, file, { contentType: file.type });

      if (error) {
        console.warn('Storage error, fallback to base64 image:', error);
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = async () => {
          const base64data = reader.result as string;
          await sendAttachmentMessage(base64data, 'image');
        };
      } else if (data) {
        const { data: urlData } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(fileName);
        await sendAttachmentMessage(urlData.publicUrl, 'image');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const triggerChatNotification = async () => {
    try {
      const { data: existingNotif } = await supabase
        .from('notifications')
        .select('id')
        .eq('title', 'Nova Mensagem no Chat')
        .eq('read', false)
        .limit(1);

      if (!existingNotif || existingNotif.length === 0) {
        await supabase
          .from('notifications')
          .insert([{
            title: 'Nova Mensagem no Chat',
            message: `Você recebeu uma nova mensagem no chat de ${senderName}.`,
            type: 'chat',
            read: false
          }]);
      }
    } catch (err) {
      console.error('Erro ao acionar notificação de chat:', err);
    }
  };

  const sendAttachmentMessage = async (urlOrData: string, type: 'image' | 'audio') => {
    if (!roomId) return;
    try {
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          room_id: roomId,
          sender_id: senderId,
          message: urlOrData,
          message_type: type
        });
      if (!error) {
        await triggerChatNotification();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 6. Enviar Mensagem de Texto
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
          message_type: 'text'
        });

      if (error) throw error;
      await triggerChatNotification();
    } catch (err) {
      console.error('Erro ao enviar mensagem:', err);
      setNewMessage(text);
    } finally {
      setSending(false);
    }
  };

  // 7. Reações de Emojis Rápido
  const handleAddReaction = async (msgId: string, emoji: string) => {
    try {
      const msg = messages.find((m) => m.id === msgId);
      if (!msg) return;

      const currentReactions = msg.reactions || {};
      const usersReacted = currentReactions[emoji] || [];

      let updatedUsers = [...usersReacted];
      if (updatedUsers.includes(senderId)) {
        updatedUsers = updatedUsers.filter((uid) => uid !== senderId);
      } else {
        updatedUsers.push(senderId);
      }

      const updatedReactions = { ...currentReactions };
      if (updatedUsers.length === 0) {
        delete updatedReactions[emoji];
      } else {
        updatedReactions[emoji] = updatedUsers;
      }

      const { error } = await supabase
        .from('chat_messages')
        .update({ reactions: updatedReactions })
        .eq('id', msgId);

      if (error) throw error;
      
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, reactions: updatedReactions } : m))
      );
    } catch (err) {
      console.error(err);
    }
  };

  // 8. Compartilhamento / Exportação da Conversa (Coach only)
  const handleShareChat = () => {
    if (messages.length === 0) return;
    const formatted = messages
      .map((msg) => {
        const date = new Date(msg.created_at).toLocaleString('pt-BR');
        const sender = msg.sender_id === coachId ? 'Professor' : 'Aluno';
        let body = msg.message;
        if (msg.message_type === 'image') body = '[Imagem Anexa]';
        if (msg.message_type === 'audio') body = '[Mensagem de Áudio]';
        return `[${date}] ${sender}: ${body}`;
      })
      .join('\n');

    navigator.clipboard
      .writeText(`--- Histórico de Conversa Elite Coach ---\n\n${formatted}`)
      .then(() => alert('Histórico copiado para a área de transferência!'))
      .catch((err) => console.error(err));
  };

  const isImageMessage = (msg: Message) => {
    if (msg.message_type === 'image') return true;
    const text = msg.message || '';
    if (text.startsWith('data:image/')) return true;
    if (text.startsWith('http') && (
      text.toLowerCase().endsWith('.png') ||
      text.toLowerCase().endsWith('.jpg') ||
      text.toLowerCase().endsWith('.jpeg') ||
      text.toLowerCase().endsWith('.gif') ||
      text.toLowerCase().endsWith('.webp') ||
      text.includes('/chat-attachments/')
    )) return true;
    return false;
  };

  const isAudioMessage = (msg: Message) => {
    if (msg.message_type === 'audio') return true;
    const text = msg.message || '';
    if (text.startsWith('data:audio/')) return true;
    if (text.startsWith('http') && (
      text.toLowerCase().endsWith('.webm') ||
      text.toLowerCase().endsWith('.mp3') ||
      text.toLowerCase().endsWith('.wav') ||
      text.toLowerCase().endsWith('.ogg')
    )) return true;
    return false;
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
      {/* Header bar */}
      <div className="bg-surface-high/60 border-b border-surface-highest/40 p-3 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2 text-zinc-300">
          <MessageSquare className="w-3.5 h-3.5 text-primary" />
          <span className="text-[10px] font-bold uppercase tracking-wider">{senderName}</span>
        </div>
        <div className="flex items-center gap-3">
          {chatRating && (
            <div className="flex items-center gap-1 bg-[#dfbf80]/10 border border-[#dfbf80]/20 px-2 py-0.5 rounded text-[9px] text-[#dfbf80]" title={chatFeedback || ''}>
              <Star className="w-3 h-3 fill-current text-primary" />
              <span className="font-bold">{chatRating} Estrelas</span>
            </div>
          )}
          {senderId === coachId && (
            <button
              onClick={handleShareChat}
              className="p-1 rounded bg-surface hover:bg-surface-high border border-surface-highest text-zinc-400 hover:text-primary transition-colors flex items-center gap-1 text-[9px] uppercase font-bold"
              title="Compartilhar Conversa"
            >
              <Share2 className="w-3 h-3" /> Exportar
            </button>
          )}
        </div>
      </div>

      {/* Messages Timeline */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[280px] max-h-[420px] scrollbar-none">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-zinc-500 gap-2 text-center px-4">
            <Sparkles className="w-6 h-6 text-primary/40 animate-pulse" />
            <p className="text-[10px] font-bold uppercase tracking-wider">Sem Mensagens</p>
            <p className="text-[9px] max-w-[200px] leading-relaxed">Inicie a conversa enviando uma mensagem no campo abaixo.</p>
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
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs shadow-md relative group/msg ${
                    isMe
                      ? 'bg-primary text-black rounded-tr-none'
                      : 'bg-surface-high border border-surface-highest text-white rounded-tl-none'
                  }`}
                >
                  {/* Floating emoji reactions bar */}
                  <div
                    className={`absolute top-0 -translate-y-[85%] opacity-0 group-hover/msg:opacity-100 transition-opacity bg-surface-high border border-surface-highest rounded-lg p-0.5 shadow-lg flex gap-1 z-10 ${
                      isMe ? 'right-0' : 'left-0'
                    }`}
                  >
                    {['👍', '❤️', '🔥', '😂', '👏'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleAddReaction(msg.id, emoji)}
                        className="hover:scale-125 transition-transform p-0.5 text-[11px]"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>

                  {/* Message body */}
                  {isImageMessage(msg) ? (
                    <a
                      href={msg.message}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block max-w-full rounded overflow-hidden border border-surface-highest bg-black"
                    >
                      <img
                        src={msg.message}
                        alt="Imagem enviada"
                        className="max-w-full h-auto object-contain max-h-48 hover:scale-105 transition-transform"
                      />
                    </a>
                  ) : isAudioMessage(msg) ? (
                    <div className="flex items-center gap-2 py-1 bg-surface-high/65 px-3 py-2 rounded-lg border border-surface-highest/50">
                      <Mic className="w-4 h-4 text-primary animate-pulse shrink-0" />
                      <audio src={msg.message} controls className="w-48 max-w-full h-8 brightness-90 contrast-125 select-none" />
                    </div>
                  ) : (
                    <p className="break-words leading-relaxed whitespace-pre-wrap">{msg.message}</p>
                  )}

                  {/* Time and unread indicator */}
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <span
                      className={`text-[7px] font-mono ${
                        isMe ? 'text-black/60' : 'text-zinc-500'
                      }`}
                    >
                      {new Date(msg.created_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  {/* Emoji Reactions count list */}
                  {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5 justify-start">
                      {Object.entries(msg.reactions).map(([emoji, uids]) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => handleAddReaction(msg.id, emoji)}
                          className={`px-1.5 py-0.5 rounded-full text-[8px] border flex items-center gap-1 transition-all ${
                            uids.includes(senderId)
                              ? 'bg-primary/20 border-primary text-primary'
                              : 'bg-surface border-surface-highest text-zinc-400 hover:border-zinc-500'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="font-mono text-[7px]">{uids.length}</span>
                        </button>
                      ))}
                    </div>
                  )}
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
        className="p-3 bg-surface/50 border-t border-surface-highest/60 flex gap-2 items-center relative"
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          className="hidden"
        />
        <button
          type="button"
          disabled={isRecording || sending}
          onClick={() => fileInputRef.current?.click()}
          className="p-2.5 rounded-lg bg-surface-high hover:bg-surface-highest text-zinc-400 hover:text-primary transition-all shrink-0 disabled:opacity-30"
          title="Enviar Imagem"
        >
          <Image className="w-4 h-4" />
        </button>

        {isRecording ? (
          <div className="flex-1 bg-red-950/20 border border-red-500/30 rounded-lg px-3 py-2 flex items-center justify-between text-[11px] text-red-400 animate-pulse">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              Gravando voz ({recordingTime}s)...
            </span>
            <button
              type="button"
              onClick={stopRecording}
              className="px-2.5 py-1 bg-red-500 text-white rounded text-[9px] font-bold uppercase hover:bg-red-600 transition-colors"
            >
              Parar & Enviar
            </button>
          </div>
        ) : (
          <>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Digite sua mensagem..."
              className="flex-1 bg-surface-high text-white text-xs px-4 py-2.5 rounded-lg border border-surface-highest/65 focus:border-primary/50 focus:outline-none placeholder-zinc-500"
            />
            <button
              type="button"
              disabled={sending}
              onClick={startRecording}
              className="p-2.5 rounded-lg bg-surface-high hover:bg-surface-highest text-zinc-400 hover:text-primary transition-all shrink-0 disabled:opacity-30"
              title="Gravar Áudio"
            >
              <Mic className="w-4 h-4" />
            </button>
          </>
        )}

        <button
          type="submit"
          disabled={!newMessage.trim() || sending || isRecording}
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
