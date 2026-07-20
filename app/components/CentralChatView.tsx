'use client';

import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { Search, MessageSquare, Sparkles, User, ChevronRight, Loader2 } from 'lucide-react';
import ChatComponent from './ChatComponent';

interface Student {
  id: string;
  name: string;
  photo_avatar_url?: string;
  email?: string;
}

interface CentralChatViewProps {
  currentUser: any;
  unreadStudents: string[];
  setQuickChatStudent: (student: any | null) => void;
}

export default function CentralChatView({
  currentUser,
  unreadStudents,
  setQuickChatStudent
}: CentralChatViewProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [lastMessages, setLastMessages] = useState<Record<string, { text: string; time: string; rawTime?: string }>>({});

  // Divisor arrastável (Splitter) states e handlers
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      if (newWidth >= 220 && newWidth <= 460) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  // 1. Carregar lista de alunos
  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('students')
          .select('id, name, photo_avatar_url, email')
          .order('name', { ascending: true });

        if (error) throw error;
        if (data) {
          setStudents(data);
          
          // Buscar última mensagem de cada sala de chat correspondente
          fetchLastMessages(data);
        }
      } catch (err) {
        console.error('Erro ao carregar alunos na Central de Chat:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  // 2. Buscar a última mensagem de cada chat para exibir prévias
  const fetchLastMessages = async (studentList: Student[]) => {
    if (!currentUser?.id) return;
    try {
      // Buscar todas as mensagens agrupadas por sala
      const { data, error } = await supabase
        .from('chat_messages')
        .select('room_id, message, created_at, sender_id, message_type, chat_rooms!inner(student_id)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const previews: Record<string, { text: string; time: string; rawTime?: string }> = {};
        studentList.forEach(student => {
          const studentMsgs = data.filter(m => {
            const room = m.chat_rooms;
            const sId = Array.isArray(room) ? room[0]?.student_id : (room as any)?.student_id;
            return sId === student.id;
          });
          if (studentMsgs.length > 0) {
            const lastMsg = studentMsgs[0];
            const isMsgAudio = lastMsg.message_type === 'audio' || 
                               lastMsg.message.startsWith('data:audio/') ||
                               (lastMsg.message.startsWith('http') && (
                                 lastMsg.message.toLowerCase().endsWith('.webm') ||
                                 lastMsg.message.toLowerCase().endsWith('.wav') ||
                                 lastMsg.message.toLowerCase().endsWith('.mp3') ||
                                 lastMsg.message.toLowerCase().endsWith('.ogg') ||
                                 lastMsg.message.toLowerCase().endsWith('.m4a') ||
                                 lastMsg.message.toLowerCase().includes('audio')
                               ));

            previews[student.id] = {
              text: isMsgAudio 
                ? '🎤 [Áudio]' 
                : lastMsg.message.startsWith('http') 
                  ? (lastMsg.message.includes('/chat-attachments/') ? '📷 [Mídia]' : '🔗 [Link]')
                  : lastMsg.message,
              time: new Date(lastMsg.created_at).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit'
              }),
              rawTime: lastMsg.created_at
            };
          }
        });
        setLastMessages(previews);
      }
    } catch (err) {
      console.error('Erro ao carregar prévias das mensagens:', err);
    }
  };

  // Filtrar alunos pela busca
  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Ordenar alunos por data da última mensagem descendente, e ordem alfabética de quem não tem conversa
  const sortedStudents = [...filteredStudents].sort((a, b) => {
    const timeA = lastMessages[a.id]?.rawTime || '';
    const timeB = lastMessages[b.id]?.rawTime || '';

    if (timeA && !timeB) return -1;
    if (!timeA && timeB) return 1;
    if (timeA && timeB) {
      return new Date(timeB).getTime() - new Date(timeA).getTime();
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div 
      ref={containerRef}
      className="h-full min-h-[500px] flex rounded-2xl bg-surface-container border border-surface-highest/40 overflow-hidden shadow-2xl animate-fade-in"
    >
      
      {/* Coluna Esquerda: Contatos */}
      <div 
        style={{ width: typeof window !== 'undefined' && window.innerWidth >= 768 ? sidebarWidth : '100%' }}
        className={`${selectedStudent ? 'hidden md:flex' : 'flex'} shrink-0 border-r border-surface-highest/40 flex-col bg-surface-high/30`}
      >
        
        {/* Header de Busca */}
        <div className="p-4 border-b border-surface-highest/40 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#dfbf80] uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" /> Central de Conversas
            </h2>
            <span className="text-[9px] bg-primary/20 text-primary font-bold px-2 py-0.5 rounded-full">
              {students.length} Alunos
            </span>
          </div>
          
          <div className="flex items-center bg-surface-high border border-surface-highest px-3 py-1.5 rounded-xl focus-within:border-primary/50 transition-all">
            <Search className="w-3.5 h-3.5 text-zinc-400 mr-2 shrink-0" />
            <input
              type="text"
              placeholder="Buscar aluno..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent border-none outline-none text-xs w-full text-white placeholder-zinc-500"
            />
          </div>
        </div>

        {/* Lista de Alunos */}
        <div className="flex-1 overflow-y-auto divide-y divide-surface-highest/20 scrollbar-none">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 text-zinc-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Carregando contatos...</span>
            </div>
          ) : sortedStudents.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 italic">
              Nenhum aluno encontrado.
            </div>
          ) : (
            sortedStudents.map(student => {
              const isSelected = selectedStudent?.id === student.id;
              const hasUnread = unreadStudents.includes(student.id.toString());
              const preview = lastMessages[student.id];

              return (
                <div
                  key={student.id}
                  onClick={() => {
                    setSelectedStudent(student);
                    // Sincroniza com o chat rápido também
                    setQuickChatStudent(null);
                  }}
                  className={`p-3.5 flex items-center gap-3 cursor-pointer transition-all hover:bg-surface-high/40 relative ${
                    isSelected ? 'bg-primary/10 border-l-4 border-primary' : 'border-l-4 border-transparent'
                  }`}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full border border-primary/20 bg-surface flex items-center justify-center shrink-0 overflow-hidden relative">
                    {student.photo_avatar_url ? (
                      <img src={student.photo_avatar_url} alt={student.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-bold text-[#dfbf80]">{student.name.charAt(0).toUpperCase()}</span>
                    )}
                    {/* Status ponto verde online */}
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-surface-container" />
                  </div>

                  {/* Nome e Prévia */}
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex justify-between items-center gap-1">
                      <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-primary' : 'text-white'}`}>
                        {student.name}
                      </h4>
                      {preview && (
                        <span className="text-[8px] text-zinc-500 shrink-0 font-mono">
                          {preview.time}
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-zinc-400 truncate mt-0.5">
                      {preview ? preview.text : 'Nenhuma mensagem enviada'}
                    </p>
                  </div>

                  {/* Indicador de não lidas */}
                  {hasUnread && (
                    <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse shrink-0 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                  )}

                  <ChevronRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Splitter arrastável (Apenas Desktop) */}
      <div 
        onMouseDown={startResizing}
        className="hidden md:block w-1 hover:w-1.5 hover:bg-primary/50 cursor-col-resize transition-all bg-surface-highest/20 self-stretch z-20 shrink-0"
      />
 
      {/* Coluna Direita: Chat Viewport */}
      <div className={`${!selectedStudent ? 'hidden md:flex' : 'flex'} flex-1 flex-col bg-surface-high/10`}>
        {selectedStudent ? (
          <div className="flex-1 h-full overflow-hidden flex flex-col">
            <ChatComponent
              studentId={selectedStudent.id}
              coachId={(currentUser?.id || '').toString()}
              senderId={(currentUser?.id || '').toString()}
              senderName={selectedStudent.name}
              onBack={() => setSelectedStudent(null)}
            />
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 gap-3 p-8 text-center animate-pulse">
            <div className="w-16 h-16 rounded-full bg-surface-high/30 border border-primary/20 flex items-center justify-center">
              <MessageSquare className="w-8 h-8 text-primary/60" />
            </div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Central de Mensagens</h3>
            <p className="text-xs text-zinc-400 max-w-[280px] leading-relaxed">
              Selecione um aluno na lista ao lado para visualizar o histórico de conversas e enviar novas mensagens.
            </p>
            <div className="flex items-center gap-1.5 text-[10px] text-primary bg-primary/5 px-3 py-1 rounded-full border border-primary/10 mt-2">
              <Sparkles className="w-3.5 h-3.5" /> Elite Coach Premium
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
