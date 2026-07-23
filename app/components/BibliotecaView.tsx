import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, X, Video, FileText, Trash2, ArrowRight, Edit3, Upload, Link, Dumbbell, Activity, Trophy, Sparkles } from 'lucide-react';
import { supabase } from '../utils/supabase';
import { User } from '../types';
import CustomAlertModal from './CustomAlertModal';

interface BibliotecaViewProps {
  currentUser: User | null;
}

export default function BibliotecaView({ currentUser }: BibliotecaViewProps) {
  const [exercises, setExercises] = useState<any[]>([]);
  
  const getExerciseAvatar = (category: string, hasVideo: boolean) => {
    let bgGradient = 'from-[#dfbf80]/20 to-[#dfbf80]/5 text-[#dfbf80] border-[#dfbf80]/30';
    let IconComponent = Dumbbell;

    const cat = category.toLowerCase();
    if (cat.includes('cardio')) {
      bgGradient = 'from-red-500/20 to-red-500/5 text-red-400 border-red-500/30';
      IconComponent = Activity;
    } else if (cat.includes('pernas') || cat.includes('glúteo')) {
      bgGradient = 'from-emerald-500/20 to-emerald-500/5 text-emerald-400 border-emerald-500/30';
      IconComponent = Trophy;
    } else if (cat.includes('braços') || cat.includes('peito') || cat.includes('costas') || cat.includes('ombros')) {
      bgGradient = 'from-amber-500/20 to-amber-500/5 text-amber-400 border-amber-500/30';
      IconComponent = Dumbbell;
    } else if (cat.includes('abdômen')) {
      bgGradient = 'from-cyan-500/20 to-cyan-500/5 text-cyan-400 border-cyan-500/30';
      IconComponent = Sparkles;
    } else {
      bgGradient = 'from-zinc-500/20 to-zinc-500/5 text-zinc-400 border-zinc-500/30';
      IconComponent = FileText;
    }

    return (
      <div className={`w-12 h-12 rounded-lg border bg-gradient-to-br ${bgGradient} flex items-center justify-center shrink-0 shadow-inner relative group/avatar`}>
        <IconComponent className="w-5 h-5 group-hover/avatar:scale-110 transition-transform" />
        {hasVideo && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-black flex items-center justify-center border border-black shadow text-[9px] font-bold">
            <Video className="w-2.5 h-2.5" />
          </span>
        )}
      </div>
    );
  };
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  // Modal states
  const [showModal, setShowModal] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [selectedExId, setSelectedExId] = useState<string | null>(null);

  // Form states
  const [formName, setFormName] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('Pernas');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formVideoUrl, setFormVideoUrl] = useState<string>('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [existingFileUrl, setExistingFileUrl] = useState<string | null>(null);
  
  const [saving, setSaving] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  // Custom Alert Modal State
  const [alertModal, setAlertModal] = useState<{
    isOpen: boolean;
    title: string;
    message?: string;
    type: 'success' | 'error' | 'warning' | 'info' | 'confirm';
    recordName?: string;
    onConfirm?: () => void;
  }>({ isOpen: false, title: '', message: '', type: 'info' });

  const showCustomAlert = (
    title: string, 
    message: string, 
    type: 'success' | 'error' | 'warning' | 'info' | 'confirm', 
    recordName?: string,
    onConfirm?: () => void
  ) => {
    setAlertModal({
      isOpen: true,
      title,
      message,
      type,
      recordName,
      onConfirm
    });
  };

  const categories = ['Todos', 'Pernas', 'Glúteo', 'Peito', 'Costas', 'Ombros', 'Braços', 'Abdômen', 'Cardio', 'Outros'];

  const fetchExercises = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('exercise_library')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error fetching exercise library:', error);
      } else if (data) {
        setExercises(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExercises();
  }, []);

  const openAddModal = () => {
    setModalMode('add');
    setSelectedExId(null);
    setFormName('');
    setFormCategory('Pernas');
    setFormDescription('');
    setFormVideoUrl('');
    setVideoFile(null);
    setExistingFileUrl(null);
    setUploadProgress('');
    setShowModal(true);
  };

  const openEditModal = (ex: any) => {
    setModalMode('edit');
    setSelectedExId(ex.id);
    setFormName(ex.name);
    setFormCategory(ex.category);
    setFormDescription(ex.description || '');
    setFormVideoUrl(ex.video_url || '');
    setExistingFileUrl(ex.video_file_url || null);
    setVideoFile(null);
    setUploadProgress('');
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim() || !formCategory) {
      return showCustomAlert('Aviso', 'Nome e categoria são obrigatórios!', 'warning');
    }

    setSaving(true);
    setUploadProgress('');

    try {
      let finalVideoFileUrl = existingFileUrl;

      // Handle video file upload to Supabase Storage if file is selected
      if (videoFile) {
        setUploadProgress('Fazendo upload do arquivo de vídeo...');
        const fileExt = videoFile.name.split('.').pop();
        const cleanName = formName.trim().replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
        const fileName = `${cleanName}_${Date.now()}.${fileExt}`;
        const filePath = `videos/${fileName}`;

        const { error: uploadError } = await supabase.storage
          .from('exercise-videos')
          .upload(filePath, videoFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          throw new Error('Falha no upload do vídeo: ' + uploadError.message + '\n\nCertifique-se de que executou o script SQL no Supabase para habilitar o RLS do Storage.');
        }

        const { data: publicUrlData } = supabase.storage
          .from('exercise-videos')
          .getPublicUrl(filePath);

        finalVideoFileUrl = publicUrlData?.publicUrl || null;
      }

      const exerciseData: any = {
        name: formName.trim(),
        category: formCategory,
        description: formDescription.trim() || null,
        video_url: formVideoUrl.trim() || null,
        video_file_url: finalVideoFileUrl
      };

      if (modalMode === 'add') {
        const { error } = await supabase
          .from('exercise_library')
          .insert([exerciseData]);

        if (error) throw error;
        showCustomAlert('Sucesso', 'Exercício cadastrado com sucesso!', 'success');
      } else {
        const { error } = await supabase
          .from('exercise_library')
          .update(exerciseData)
          .eq('id', selectedExId);

        if (error) throw error;
        showCustomAlert('Sucesso', 'Exercício atualizado com sucesso!', 'success');
      }

      setShowModal(false);
      fetchExercises();
    } catch (err: any) {
      console.error(err);
      showCustomAlert('Erro', err.message || 'Falha ao salvar as informações.', 'error');
    } finally {
      setSaving(false);
      setUploadProgress('');
    }
  };

  const handleDeleteClick = (id: string, name: string) => {
    showCustomAlert(
      'Confirmar Exclusão',
      '',
      'confirm',
      name,
      () => executeDelete(id)
    );
  };

  const executeDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('exercise_library')
        .delete()
        .eq('id', id);

      if (error) {
        showCustomAlert('Erro', 'Erro ao excluir exercício: ' + error.message, 'error');
      } else {
        fetchExercises();
      }
    } catch (err: any) {
      console.error(err);
    }
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return null;
    let videoId = '';
    
    if (url.includes('youtube.com/shorts/')) {
      videoId = url.split('youtube.com/shorts/')[1]?.split('?')[0]?.split('/')[0] || '';
    } else if (url.includes('youtu.be/')) {
      videoId = url.split('youtu.be/')[1]?.split('?')[0]?.split('/')[0] || '';
    } else if (url.includes('youtube.com/watch')) {
      try {
        const params = new URLSearchParams(url.split('?')[1]);
        videoId = params.get('v') || '';
      } catch (e) {
        videoId = url.split('v=')[1]?.split('&')[0] || '';
      }
    } else if (url.includes('youtube.com/embed/')) {
      return url;
    }
    
    if (videoId) {
      return `https://www.youtube.com/embed/${videoId}?mute=1`;
    }
    
    if (url.includes('vimeo.com/')) {
      const vimeoId = url.split('vimeo.com/')[1]?.split('?')[0] || '';
      if (vimeoId) return `https://player.vimeo.com/video/${vimeoId}`;
    }
    
    return null;
  };

  const handleRemoveUploadedFile = () => {
    setExistingFileUrl(null);
    setVideoFile(null);
  };

  const filteredExercises = exercises.filter(ex => {
    const matchesSearch = ex.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (ex.description && ex.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'Todos' || ex.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-heading font-bold text-white">Biblioteca de Exercícios</h2>
          <p className="text-zinc-400 text-sm mt-1">Gerencie os vídeos e instruções de execução para os treinos de seus alunos.</p>
        </div>
        <button onClick={openAddModal} className="px-4 py-2 bg-primary text-black font-bold rounded flex items-center gap-2 hover:bg-primary-dim transition-colors text-sm shadow-[0_0_10px_rgba(212,175,55,0.3)] w-full sm:w-auto justify-center">
          <Plus className="w-4 h-4" /> Cadastrar Exercício
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-surface-container border border-surface-highest p-4 rounded-xl">
        <div className="flex items-center bg-surface-high rounded-full border border-surface-highest px-3 py-1.5 w-full md:w-80 focus-within:border-primary/50 transition-colors">
          <Search className="w-4 h-4 text-zinc-400 mr-2 shrink-0" />
          <input 
            type="text" 
            placeholder="Buscar exercício..." 
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-zinc-500" 
          />
        </div>

        <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none w-full md:w-auto">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
                selectedCategory === cat ? 'bg-primary text-black' : 'bg-surface-high text-zinc-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Exercise Grid */}
      {loading ? (
        <p className="text-zinc-500 text-sm py-4 italic animate-pulse">Carregando biblioteca...</p>
      ) : filteredExercises.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-zinc-500 bg-surface-high/10 rounded-xl border border-dashed border-surface-highest">
          <FileText className="w-12 h-12 mb-3 opacity-20" />
          <p className="text-sm">Nenhum exercício encontrado nesta categoria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredExercises.map((ex) => (
            <motion.div 
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              key={ex.id}
              className="bg-surface-container border border-surface-highest p-5 rounded-xl hover:border-primary/30 transition-all flex flex-col justify-between group h-full relative"
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-3">
                  <span className="px-2 py-0.5 bg-primary/10 text-primary border border-primary/20 rounded text-[9px] font-bold uppercase tracking-widest">
                    {ex.category}
                  </span>
                  <div className="flex items-center gap-1">
                    <button 
                      onClick={() => openEditModal(ex)}
                      className="text-zinc-600 hover:text-primary transition-colors p-1"
                      title="Editar exercício"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDeleteClick(ex.id, ex.name)}
                      className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                      title="Excluir exercício"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Video Preview Block */}
                {(() => {
                  if (ex.video_file_url) {
                    return (
                      <div className="w-full aspect-video rounded-lg overflow-hidden border border-surface-highest bg-black mb-3">
                        <video 
                          src={ex.video_file_url} 
                          controls 
                          muted 
                          playsInline 
                          className="w-full h-full object-cover"
                        />
                      </div>
                    );
                  }
                  
                  const embedUrl = getEmbedUrl(ex.video_url);
                  if (embedUrl) {
                    return (
                      <div className="w-full aspect-video rounded-lg overflow-hidden border border-surface-highest bg-black mb-3">
                        <iframe 
                          src={embedUrl} 
                          className="w-full h-full border-none"
                          allowFullScreen
                          title={ex.name}
                          loading="lazy"
                        />
                      </div>
                    );
                  }
                  
                  return null;
                })()}
                
                <div className="flex items-center gap-3 mb-3 mt-1">
                  {getExerciseAvatar(ex.category, !!(ex.video_file_url || ex.video_url))}
                  <div className="flex-1 min-w-0 text-left">
                    <h4 className="font-heading font-semibold text-sm text-white group-hover:text-primary transition-colors leading-tight truncate" title={ex.name}>
                      {ex.name}
                    </h4>
                    {ex.description ? (
                      <p className="text-zinc-400 text-[10px] leading-snug mt-0.5 line-clamp-2" title={ex.description}>
                        {ex.description}
                      </p>
                    ) : (
                      <p className="text-zinc-600 text-[10px] italic mt-0.5">Sem instruções cadastradas.</p>
                    )}
                  </div>
                </div>

                {/* Availability status layout */}
                <div className="flex flex-col gap-1.5 text-[10px] text-zinc-400 bg-surface-high/40 p-2.5 rounded-lg border border-surface-highest/40 mb-4 mt-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><Link className="w-3 h-3 text-zinc-500" /> Link Externo:</span>
                    {ex.video_url ? (
                      <span className="text-[#00ff41] font-bold">✅ Vinculado</span>
                    ) : (
                      <span className="text-zinc-600 italic">❌ Sem Vínculo</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1"><Upload className="w-3 h-3 text-zinc-500" /> Vídeo Físico:</span>
                    {ex.video_file_url ? (
                      <span className="text-primary font-bold">✅ Vinculado</span>
                    ) : (
                      <span className="text-zinc-600 italic">❌ Sem Vínculo</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Dynamic bottom action buttons */}
              <div className="border-t border-surface-highest/40 pt-4 flex gap-2">
                {ex.video_file_url && (
                  <a 
                    href={ex.video_file_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 py-1.5 bg-primary/10 text-primary border border-primary/20 text-[10px] font-bold uppercase rounded flex items-center justify-center gap-1 hover:bg-primary/20 transition-all shadow-sm"
                  >
                    <Video className="w-3.5 h-3.5" /> Vídeo Local
                  </a>
                )}
                {ex.video_url && (
                  <a 
                    href={ex.video_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex-1 py-1.5 bg-surface border border-surface-highest text-[10px] font-bold uppercase rounded flex items-center justify-center gap-1 hover:text-white transition-all text-zinc-300"
                  >
                    <Video className="w-3.5 h-3.5 text-[#dfbf80]" /> Link Externo
                  </a>
                )}
                {!ex.video_file_url && !ex.video_url && (
                  <span className="text-zinc-600 text-[10px] italic text-center w-full py-1">Nenhum vídeo disponível.</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 20 }}
              className="bg-surface-container border border-surface-highest rounded-xl p-6 max-w-md w-full relative my-8"
            >
              <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white">
                <X className="w-5 h-5"/>
              </button>
              
              <h3 className="text-xl font-heading font-bold text-white mb-6 border-b border-surface-highest pb-2">
                {modalMode === 'add' ? 'Cadastrar Novo Exercício' : 'Editar Exercício'}
              </h3>
              
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold">Nome do Exercício *</label>
                  <input 
                    required 
                    type="text" 
                    value={formName} 
                    onChange={e => setFormName(e.target.value)} 
                    className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary" 
                    placeholder="Ex: Supino Inclinado com Halteres"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold">Categoria *</label>
                  <select 
                    value={formCategory} 
                    onChange={e => setFormCategory(e.target.value)} 
                    className="w-full bg-surface-high border border-surface-highest text-white rounded p-2.5 mt-1 text-sm outline-none focus:border-primary"
                  >
                    {categories.filter(c => c !== 'Todos').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold">Instruções / Descrição</label>
                  <textarea 
                    value={formDescription} 
                    onChange={e => setFormDescription(e.target.value)} 
                    className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary h-20 resize-none" 
                    placeholder="Dicas de execução, postura e segurança..."
                  />
                </div>

                {/* Coexisting Media Configuration Fields */}
                <div className="space-y-3 pt-2 border-t border-surface-highest/40">
                  <span className="text-xs text-zinc-300 font-bold block mb-1">Mídias Vinculadas</span>
                  
                  {/* External Link Input Block */}
                  <div className="bg-surface-high border border-surface-highest/60 p-3 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] text-zinc-400 uppercase font-bold flex items-center gap-1.5">
                        <Link className="w-3.5 h-3.5 text-zinc-500" /> Link de Vídeo Externo
                      </label>
                      {formVideoUrl.trim() && (
                        <span className="text-[9px] text-[#00ff41] font-bold bg-[#00ff41]/10 border border-[#00ff41]/20 px-1.5 py-0.5 rounded">
                          Ativo
                        </span>
                      )}
                    </div>
                    <input 
                      type="url" 
                      value={formVideoUrl} 
                      onChange={e => setFormVideoUrl(e.target.value)} 
                      className="w-full bg-surface-container border border-surface-highest rounded p-2 text-white text-xs outline-none focus:border-primary" 
                      placeholder="Ex: https://www.youtube.com/watch?..."
                    />
                    {formVideoUrl.trim() && (
                      <div className="text-[10px] text-zinc-500 flex justify-between items-center px-1">
                        <span className="truncate max-w-[250px]">{formVideoUrl}</span>
                        <button 
                          type="button" 
                          onClick={() => setFormVideoUrl('')} 
                          className="text-red-400 hover:underline font-bold"
                        >
                          Limpar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* MP4 File Upload Input Block */}
                  <div className="bg-surface-high border border-surface-highest/60 p-3 rounded-lg space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[11px] text-zinc-400 uppercase font-bold flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5 text-zinc-500" /> Upload de Vídeo MP4
                      </label>
                      {existingFileUrl && (
                        <span className="text-[9px] text-primary font-bold bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded">
                          Salvo em Nuvem
                        </span>
                      )}
                    </div>

                    {existingFileUrl ? (
                      <div className="bg-surface-container border border-surface-highest rounded p-2.5 flex items-center justify-between gap-3 shadow-inner">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <Video className="w-8 h-8 text-primary shrink-0 opacity-80" />
                          <div className="flex flex-col overflow-hidden">
                            <span className="text-xs font-bold text-zinc-200 truncate">video_exercicio.mp4</span>
                            <a 
                              href={existingFileUrl} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-[10px] text-primary hover:underline font-medium text-left"
                            >
                              Ver Vídeo Salvo
                            </a>
                          </div>
                        </div>
                        <button 
                          type="button" 
                          onClick={handleRemoveUploadedFile} 
                          className="text-zinc-500 hover:text-red-400 p-1.5 hover:bg-surface rounded transition-colors"
                          title="Remover vídeo em nuvem"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="border border-dashed border-surface-highest rounded p-3 flex flex-col items-center justify-center bg-surface-container/50 hover:border-primary/40 transition-colors">
                        <input 
                          type="file" 
                          accept="video/mp4,video/quicktime,video/webm" 
                          onChange={e => setVideoFile(e.target.files?.[0] || null)}
                          className="hidden" 
                          id="video-upload-input"
                        />
                        <label htmlFor="video-upload-input" className="cursor-pointer flex flex-col items-center gap-1.5 w-full text-center">
                          <Upload className="w-6 h-6 text-primary opacity-80" />
                          <span className="text-xs font-bold text-zinc-300">
                            {videoFile ? videoFile.name : 'Selecionar arquivo de vídeo'}
                          </span>
                          <span className="text-[9px] text-zinc-500">
                            Formatos MP4, MOV. Máximo 10MB.
                          </span>
                        </label>
                      </div>
                    )}
                    
                    {videoFile && (
                      <div className="text-[10px] text-zinc-400 bg-surface-container p-2 rounded flex items-center justify-between border border-surface-highest">
                        <span className="truncate max-w-[200px]">Selecionado: {videoFile.name}</span>
                        <button 
                          type="button" 
                          onClick={() => setVideoFile(null)} 
                          className="text-red-400 hover:underline font-bold"
                        >
                          Limpar
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {uploadProgress && (
                  <p className="text-xs font-mono text-primary animate-pulse">{uploadProgress}</p>
                )}

                <button 
                  type="submit" 
                  disabled={saving}
                  className="w-full py-3 mt-4 bg-primary text-black font-bold uppercase tracking-wider rounded border border-primary/30 hover:bg-primary-dim transition-colors shadow-[0_0_15px_rgba(212,175,55,0.2)] disabled:opacity-50"
                >
                  {saving ? 'Processando...' : modalMode === 'add' ? 'Salvar Exercício' : 'Atualizar Exercício'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <CustomAlertModal
        isOpen={alertModal.isOpen}
        type={alertModal.type}
        title={alertModal.title}
        message={alertModal.message}
        recordName={alertModal.recordName}
        currentUser={currentUser}
        onClose={() => setAlertModal(prev => ({ ...prev, isOpen: false }))}
        onConfirm={alertModal.onConfirm}
      />
    </div>
  );
}
