'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { Send, MessageSquare, Loader2, Share2, Image, Mic, Star, Sparkles, CornerUpLeft, Edit2, Trash2, X, ChevronLeft } from 'lucide-react';

interface ChatComponentProps {
  studentId: string;
  coachId: string;
  senderId: string;
  senderName: string;
  isPublic?: boolean;
  onBack?: () => void;
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
  reply_to_id?: string | null;
  is_edited?: boolean;
  deleted_for_everyone?: boolean;
}

function PremiumAudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };
    
    const onTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    // Se já estiver carregado
    if (audio.duration && !isNaN(audio.duration)) {
      setDuration(audio.duration);
    }

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, [src]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.error("Erro ao tocar áudio:", err);
      });
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const val = parseFloat(e.target.value);
    audio.currentTime = val;
    setCurrentTime(val);
  };

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="flex items-center gap-3 bg-surface-high border border-surface-highest/60 rounded-xl px-4 py-2.5 w-[260px] max-w-full shadow-md select-none text-white my-1">
      <audio ref={audioRef} src={src} preload="metadata" />
      
      {/* Botão Play/Pause */}
      <button 
        type="button" 
        onClick={togglePlay}
        className="w-8 h-8 rounded-full bg-primary hover:scale-105 active:scale-95 transition-all flex items-center justify-center text-black shrink-0 shadow-md animate-in fade-in duration-200"
      >
        {isPlaying ? (
          <span className="flex items-center gap-0.5 justify-center">
            <span className="w-1 h-3 bg-black rounded-sm" />
            <span className="w-1 h-3 bg-black rounded-sm" />
          </span>
        ) : (
          <svg className="w-3.5 h-3.5 fill-current text-black ml-0.5" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      {/* Visual da Onda / Slider */}
      <div className="flex-1 flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-1.5 h-3 relative">
          <input 
            type="range" 
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={handleSeek}
            className="w-full accent-primary h-1 bg-surface-highest rounded-lg appearance-none cursor-pointer range-sm"
          />
        </div>
        
        {/* Metadados e Duração */}
        <div className="flex justify-between items-center text-[8.5px] text-zinc-400 font-mono">
          <span>{formatTime(currentTime)}</span>
          <div className="flex items-center gap-1">
            <Mic className="w-2.5 h-2.5 text-primary" />
            <span>Áudio ({formatTime(duration)})</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ChatComponent({
  studentId,
  coachId,
  senderId,
  senderName,
  isPublic = false,
  onBack,
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

  // Reply, Edit and local delete states
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [localDeletedIds, setLocalDeletedIds] = useState<string[]>([]);
  const [activeDeleteMenuId, setActiveDeleteMenuId] = useState<string | null>(null);
  const [activeActionMsgId, setActiveActionMsgId] = useState<string | null>(null);

  // Carregar mensagens excluídas localmente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(`deleted_chat_msgs_${senderId}`);
      if (saved) {
        setLocalDeletedIds(JSON.parse(saved));
      }
    }
  }, [senderId]);

  const handleDeleteLocal = (msgId: string) => {
    const updated = [...localDeletedIds, msgId];
    setLocalDeletedIds(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`deleted_chat_msgs_${senderId}`, JSON.stringify(updated));
    }
  };

  const handleDeleteForEveryone = async (msgId: string) => {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({
          deleted_for_everyone: true,
          message: '🚫 Esta mensagem foi apagada'
        })
        .eq('id', msgId);

      if (error) throw error;

      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, deleted_for_everyone: true, message: '🚫 Esta mensagem foi apagada' } : m))
      );
    } catch (err) {
      console.error('Erro ao apagar mensagem:', err);
    }
  };

  // Play synthetic premium ding sound on new messages
  const playNotificationSound = () => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime); // High pitch Premium chime
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      // audio context blocked or not supported
    }
  };

  // 1. Inicializar Sala de Chat
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

        // Marcar mensagens recebidas como lidas no carregamento inicial
        const unreadMsgs = (data || []).filter(m => m.sender_id !== senderId && !m.read);
        if (unreadMsgs.length > 0) {
          await supabase
            .from('chat_messages')
            .update({ read: true })
            .in('id', unreadMsgs.map(m => m.id));
        }
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
                  // Marcar nova mensagem como lida em tempo real
                  supabase
                    .from('chat_messages')
                    .update({ read: true })
                    .eq('id', newMsg.id)
                    .then();
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

        // 1. Try direct Supabase storage upload if available
        try {
          const fileName = `${roomId}/voice_${Date.now()}.webm`;
          const { data, error } = await supabase.storage
            .from('chat-attachments')
            .upload(fileName, audioBlob, { contentType: 'audio/webm' });
            
          if (!error && data) {
            const { data: { publicUrl } } = supabase.storage
              .from('chat-attachments')
              .getPublicUrl(fileName);
            await sendAttachmentMessage(publicUrl, 'audio');
            return;
          }
        } catch (storageErr) {
          // ignore storage error, proceed to base64 fallback
        }

        // 2. Base64 fallback if storage fails
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
          const base64data = reader.result as string;
          sendAttachmentMessage(base64data, 'audio');
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Erro ao acessar microfone:', err);
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

  // 5. Envio de Imagens (Upload ou Base64 Fallback)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !roomId || sending) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione uma imagem válida!');
      return;
    }

    setSending(true);
    // 1. Try Supabase Storage
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${roomId}/img_${Date.now()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from('chat-attachments')
        .upload(fileName, file);

      if (!error && data) {
        const { data: { publicUrl } } = supabase.storage
          .from('chat-attachments')
          .getPublicUrl(fileName);
        await sendAttachmentMessage(publicUrl, 'image');
        setSending(false);
        return;
      }
    } catch (storageErr) {
      // ignore storage error, proceed to base64
    }

    // 2. Base64 Fallback
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const base64data = reader.result as string;
      await sendAttachmentMessage(base64data, 'image');
      setSending(false);
    };
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

  // 6. Enviar ou Editar Mensagem
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !roomId || sending) return;

    setSending(true);
    const text = newMessage.trim();
    setNewMessage('');

    try {
      if (editingMessage) {
        const { error } = await supabase
          .from('chat_messages')
          .update({
            message: text,
            is_edited: true
          })
          .eq('id', editingMessage.id);

        if (error) throw error;

        setMessages((prev) =>
          prev.map((m) => (m.id === editingMessage.id ? { ...m, message: text, is_edited: true } : m))
        );
        setEditingMessage(null);
      } else {
        const insertPayload: any = {
          room_id: roomId,
          sender_id: senderId,
          message: text,
          message_type: 'text'
        };

        if (replyingTo) {
          insertPayload.reply_to_id = replyingTo.id;
        }

        const { error } = await supabase
          .from('chat_messages')
          .insert(insertPayload);

        if (error) throw error;
        await triggerChatNotification();
        setReplyingTo(null);
      }
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
      console.error('Erro ao adicionar reação:', err);
    }
  };

  // 8. Compartilhamento Externo de Conversas
  const handleShareChat = () => {
    try {
      const chatText = messages
        .filter((msg) => !localDeletedIds.includes(msg.id))
        .map((msg) => {
          const sender = msg.sender_id === coachId ? 'Treinador' : 'Aluno';
          const time = new Date(msg.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
          const content = msg.message_type === 'image' ? '[Imagem]' : msg.message_type === 'audio' ? '[Áudio]' : msg.message;
          return `[${time}] ${sender}: ${content}`;
        })
        .join('\n');

      const textToShare = `Elite Coach - Relatório de Conversa com ${senderName}:\n\n${chatText}`;
      if (navigator.share) {
        navigator.share({
          title: `Elite Coach - Conversa com ${senderName}`,
          text: textToShare
        });
      } else {
        navigator.clipboard.writeText(textToShare);
        alert('Histórico de conversas copiado para a área de transferência!');
      }
    } catch (e) {
      console.error('Erro ao compartilhar conversa:', e);
    }
  };

  const isImageMessage = (msg: Message) => {
    if (msg.message_type === 'image') return true;
    if (msg.message_type === 'audio') return false;
    const text = msg.message || '';
    if (text.startsWith('data:image/')) return true;
    if (text.startsWith('data:audio/')) return false;

    const lowerText = text.toLowerCase();
    if (lowerText.endsWith('.webm') || 
        lowerText.endsWith('.wav') || 
        lowerText.endsWith('.mp3') || 
        lowerText.endsWith('.ogg') || 
        lowerText.endsWith('.m4a') ||
        lowerText.includes('audio') ||
        lowerText.includes('chat-audio')) {
      return false;
    }

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
      text.toLowerCase().endsWith('.wav') ||
      text.toLowerCase().endsWith('.mp3') ||
      text.toLowerCase().endsWith('.ogg') ||
      text.toLowerCase().endsWith('.m4a') ||
      text.toLowerCase().includes('audio') ||
      text.toLowerCase().includes('chat-audio')
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
    <div className="flex flex-col h-full bg-surface-container select-none">
      {/* Header Info */}
      <div className="bg-surface-high border-b border-surface-highest/40 p-3 flex justify-between items-center shrink-0 z-10 shadow-sm relative">
        <div className="flex items-center gap-2 text-zinc-300">
          {onBack && (
            <button 
              type="button"
              onClick={onBack}
              className="md:hidden mr-1 p-1 hover:bg-surface-high/80 rounded-lg text-zinc-400 hover:text-white transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
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
      <div 
        onClick={() => setActiveDeleteMenuId(null)}
        className="flex-1 overflow-y-auto p-4 space-y-4 min-h-[200px] scrollbar-none relative z-0"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-16 text-zinc-500 gap-2 text-center px-4">
            <Sparkles className="w-6 h-6 text-primary/40 animate-pulse" />
            <p className="text-[10px] font-bold uppercase tracking-wider">Sem Mensagens</p>
            <p className="text-[9px] max-w-[200px] leading-relaxed">Inicie a conversa enviando uma mensagem no campo abaixo.</p>
          </div>
        ) : (
          messages
            .filter((msg) => !localDeletedIds.includes(msg.id))
            .map((msg) => {
              const isMe = msg.sender_id === senderId;
              return (
                <div
                  key={msg.id}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  onClick={() => setActiveActionMsgId(activeActionMsgId === msg.id ? null : msg.id)}
                >
                  <div
                    className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3.5 py-2 text-xs shadow-md relative group/msg cursor-pointer ${
                      isMe
                        ? 'bg-primary text-black rounded-tr-none'
                        : 'bg-surface-high border border-surface-highest text-white rounded-tl-none'
                    }`}
                  >
                    {/* Floating emoji and actions bar (visível por hover no desktop ou por toque no mobile) */}
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute -top-9 transition-all duration-200 bg-surface-dark border border-surface-highest/80 rounded-xl p-1 shadow-2xl flex items-center gap-1 z-20 backdrop-blur-md ${
                        activeActionMsgId === msg.id 
                          ? 'opacity-100 scale-100 pointer-events-auto' 
                          : 'opacity-0 pointer-events-none group-hover/msg:opacity-100 group-hover/msg:pointer-events-auto group-hover/msg:scale-100 scale-95'
                      } ${
                        isMe ? 'right-0' : 'left-0'
                      }`}
                    >
                      {/* Emojis */}
                      <div className="flex gap-0.5">
                        {['👍', '❤️', '🔥', '😂', '👏'].map((emoji) => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddReaction(msg.id, emoji);
                              setActiveActionMsgId(null);
                            }}
                            className="hover:scale-125 active:scale-95 transition-transform p-0.5 text-xs"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>

                      {!msg.deleted_for_everyone && (
                        <>
                          <div className="w-[1px] h-3 bg-surface-highest mx-0.5" />
                          
                          {/* Responder */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setReplyingTo(msg);
                              setActiveActionMsgId(null);
                            }}
                            className="p-1 rounded hover:bg-surface text-zinc-300 hover:text-primary transition-colors"
                            title="Responder"
                          >
                            <CornerUpLeft className="w-3 h-3" />
                          </button>

                          {/* Editar (apenas minhas mensagens de texto) */}
                          {isMe && msg.message_type === 'text' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingMessage(msg);
                                setNewMessage(msg.message);
                                setReplyingTo(null);
                                setActiveActionMsgId(null);
                              }}
                              className="p-1 rounded hover:bg-surface text-zinc-300 hover:text-[#dfbf80] transition-colors"
                              title="Editar"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}

                          {/* Apagar */}
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDeleteMenuId(activeDeleteMenuId === msg.id ? null : msg.id);
                              }}
                              className={`p-1 rounded hover:bg-surface transition-colors ${
                                activeDeleteMenuId === msg.id ? 'bg-surface text-red-400' : 'text-zinc-300 hover:text-red-400'
                              }`}
                              title="Apagar"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                            
                            {/* Submenu de exclusão */}
                            {activeDeleteMenuId === msg.id && (
                              <div className={`absolute bottom-full mb-2 flex flex-col bg-surface-high border border-surface-highest rounded-lg shadow-xl py-1 z-30 text-[10px] min-w-[110px] ${
                                isMe ? 'right-0' : 'left-0'
                              }`}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteLocal(msg.id);
                                    setActiveDeleteMenuId(null);
                                    setActiveActionMsgId(null);
                                  }}
                                  className="px-3 py-1.5 text-left text-zinc-200 hover:bg-surface hover:text-white transition-colors"
                                >
                                  Apagar para mim
                                </button>
                                {isMe && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeleteForEveryone(msg.id);
                                      setActiveDeleteMenuId(null);
                                      setActiveActionMsgId(null);
                                    }}
                                    className="px-3 py-1.5 text-left text-red-400 hover:bg-red-950/20 hover:text-red-300 transition-colors border-t border-surface-highest/40"
                                  >
                                    Apagar para todos
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Bloco de mensagem respondida */}
                    {msg.reply_to_id && (
                      (() => {
                        const repliedMsg = messages.find(m => m.id === msg.reply_to_id);
                        if (!repliedMsg) return null;
                        return (
                          <div className={`mb-1.5 p-1.5 rounded text-[10px] border-l-2 bg-black/15 text-left truncate max-w-full ${
                            isMe ? 'border-black/50 text-black/80' : 'border-primary/50 text-zinc-300'
                          }`}>
                            <span className="font-bold block text-[8px] uppercase tracking-wider">
                              {repliedMsg.sender_id === senderId ? 'Você' : (repliedMsg.sender_id === coachId ? 'Professor' : 'Aluno')}
                            </span>
                            {repliedMsg.message_type === 'image' ? '📷 [Imagem]' : (repliedMsg.message_type === 'audio' ? '🎵 [Áudio]' : repliedMsg.message)}
                          </div>
                        );
                      })()
                    )}

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
                      <PremiumAudioPlayer src={msg.message} />
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
                        {msg.is_edited && !msg.deleted_for_everyone && <span className="italic mr-1">(editada)</span>}
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
        className="p-3 bg-surface/50 border-t border-surface-highest/60 flex flex-col gap-2 relative"
      >
        {/* Reply Context Bar */}
        {replyingTo && (
          <div className="flex justify-between items-center bg-surface-high/60 border-l-2 border-primary px-3 py-1.5 rounded text-[10px] text-zinc-300 mb-1 w-full shrink-0">
            <div className="truncate text-left">
              <span className="font-bold block text-[8px] text-primary uppercase tracking-wider">Respondendo a {replyingTo.sender_id === senderId ? 'Você' : 'Treinador'}</span>
              <span className="italic">{replyingTo.message_type === 'image' ? '📷 Imagem' : (replyingTo.message_type === 'audio' ? '🎵 Áudio' : replyingTo.message)}</span>
            </div>
            <button
              type="button"
              onClick={() => setReplyingTo(null)}
              className="p-0.5 hover:bg-surface-highest rounded text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Edit Context Bar */}
        {editingMessage && (
          <div className="flex justify-between items-center bg-surface-high/60 border-l-2 border-[#dfbf80] px-3 py-1.5 rounded text-[10px] text-zinc-300 mb-1 w-full shrink-0">
            <div className="truncate text-left">
              <span className="font-bold block text-[8px] text-[#dfbf80] uppercase tracking-wider">Editando Mensagem</span>
              <span className="italic">{editingMessage.message}</span>
            </div>
            <button
              type="button"
              onClick={() => {
                setEditingMessage(null);
                setNewMessage('');
              }}
              className="p-0.5 hover:bg-surface-highest rounded text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <div className="flex gap-2 items-center w-full">
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
        </div>
      </form>
    </div>
  );
}
