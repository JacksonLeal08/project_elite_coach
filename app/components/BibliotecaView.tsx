import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Plus, X, Video, FileText, Trash2, ArrowRight } from 'lucide-react';
import { supabase } from '../utils/supabase';

export default function BibliotecaView() {
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');

  // Modal form states
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [newEx, setNewEx] = useState({
    name: '',
    category: 'Pernas',
    video_url: '',
    description: ''
  });
  const [saving, setSaving] = useState<boolean>(false);

  const categories = ['Todos', 'Pernas', 'Peito', 'Costas', 'Ombros', 'Braços', 'Abdômen', 'Cardio', 'Outros'];

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

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEx.name || !newEx.category) {
      return alert('Nome e categoria são obrigatórios!');
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('exercise_library')
        .insert([{
          name: newEx.name.trim(),
          category: newEx.category,
          video_url: newEx.video_url.trim() || null,
          description: newEx.description.trim() || null
        }]);

      if (error) {
        alert('Erro ao cadastrar exercício: ' + error.message);
      } else {
        alert('Exercício cadastrado com sucesso!');
        setShowAddModal(false);
        setNewEx({ name: '', category: 'Pernas', video_url: '', description: '' });
        fetchExercises();
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente excluir o exercício "${name}" da biblioteca?`)) return;
    try {
      const { error } = await supabase
        .from('exercise_library')
        .delete()
        .eq('id', id);

      if (error) {
        alert('Erro ao excluir exercício: ' + error.message);
      } else {
        fetchExercises();
      }
    } catch (err: any) {
      console.error(err);
    }
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
        <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-primary text-black font-bold rounded flex items-center gap-2 hover:bg-primary-dim transition-colors text-sm shadow-[0_0_10px_rgba(212,175,55,0.3)] w-full sm:w-auto justify-center">
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
                  <button 
                    onClick={() => handleDelete(ex.id, ex.name)}
                    className="text-zinc-600 hover:text-red-400 transition-colors p-1"
                    title="Excluir exercício"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                
                <h4 className="font-heading font-semibold text-lg text-white group-hover:text-primary transition-colors mb-2">
                  {ex.name}
                </h4>
                
                {ex.description ? (
                  <p className="text-zinc-400 text-xs leading-relaxed mb-4 line-clamp-3" title={ex.description}>
                    {ex.description}
                  </p>
                ) : (
                  <p className="text-zinc-600 text-xs italic mb-4">Sem instruções cadastradas.</p>
                )}
              </div>

              <div className="border-t border-surface-highest/40 pt-4 mt-2">
                {ex.video_url ? (
                  <a 
                    href={ex.video_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-xs font-bold text-primary hover:text-white transition-colors"
                  >
                    <Video className="w-4 h-4" /> Assistir Execução <ArrowRight className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-zinc-600 text-xs italic">Nenhum vídeo anexado.</span>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, y: 20 }} 
              animate={{ opacity: 1, y: 0 }} 
              exit={{ opacity: 0, y: 20 }}
              className="bg-surface-container border border-surface-highest rounded-xl p-6 max-w-md w-full relative"
            >
              <button onClick={() => setShowAddModal(false)} className="absolute top-4 right-4 text-zinc-400 hover:text-white">
                <X className="w-5 h-5"/>
              </button>
              
              <h3 className="text-xl font-heading font-bold text-white mb-6 border-b border-surface-highest pb-2">Cadastrar Novo Exercício</h3>
              
              <form onSubmit={handleAddSubmit} className="space-y-4">
                <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold">Nome do Exercício *</label>
                  <input 
                    required 
                    type="text" 
                    value={newEx.name} 
                    onChange={e => setNewEx({...newEx, name: e.target.value})} 
                    className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary" 
                    placeholder="Ex: Supino Inclinado com Halteres"
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold">Categoria *</label>
                  <select 
                    value={newEx.category} 
                    onChange={e => setNewEx({...newEx, category: e.target.value})} 
                    className="w-full bg-surface-high border border-surface-highest text-white rounded p-2.5 mt-1 text-sm outline-none focus:border-primary"
                  >
                    {categories.filter(c => c !== 'Todos').map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold">URL do Vídeo de Execução (YouTube / Vimeo)</label>
                  <input 
                    type="url" 
                    value={newEx.video_url} 
                    onChange={e => setNewEx({...newEx, video_url: e.target.value})} 
                    className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary" 
                    placeholder="Ex: https://www.youtube.com/watch?..."
                  />
                </div>

                <div>
                  <label className="text-xs text-zinc-400 uppercase font-bold">Instruções / Descrição</label>
                  <textarea 
                    value={newEx.description} 
                    onChange={e => setNewEx({...newEx, description: e.target.value})} 
                    className="w-full bg-surface-high border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary h-24 resize-none" 
                    placeholder="Dicas de execução, postura e segurança..."
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={saving}
                  className="w-full py-3 mt-4 bg-primary text-black font-bold uppercase tracking-wider rounded border border-primary/30 hover:bg-primary-dim transition-colors shadow-[0_0_15px_rgba(212,175,55,0.2)] disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar Exercício'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
