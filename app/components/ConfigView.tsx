import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, Users, Settings, CheckCircle2, X, RotateCcw, Share2, Eye, EyeOff, Copy, HelpCircle, Info } from 'lucide-react';
import CustomAlertModal from './CustomAlertModal';
import { generatePDFAndShare } from '../utils/pdf';
import { User, ProfileConfig, HistoryEntry } from '../types';
import { supabase } from '../utils/supabase';

interface ConfigViewProps {
  currentUser: User | null;
  onUserUpdate?: (user: User) => void;
  brandSettings?: any;
  fetchBrandSettings?: () => Promise<void>;
}

export default function ConfigView({ currentUser, onUserUpdate, brandSettings, fetchBrandSettings }: ConfigViewProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState<boolean>(true);
  const [newUser, setNewUser] = useState({ name: '', email: '', role: 'Treinador', password: '', expires_at: '', username: '' });
  const [adding, setAdding] = useState<boolean>(false);

  const [showNewUserPassword, setShowNewUserPassword] = useState<boolean>(false);

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

  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [editForm, setEditForm] = useState<User | null>(null);

  const [theme, setTheme] = useState<string>('dark');
  const [lastCreatedUser, setLastCreatedUser] = useState<{
    name: string;
    username: string;
    password: string;
    role: string;
  } | null>(null);

  const [showTokenGuide, setShowTokenGuide] = useState<boolean>(false);
  const [showChatIdGuide, setShowChatIdGuide] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const themeKey = currentUser?.id ? `elite_coach_theme_${currentUser.id}` : 'elite_coach_theme';
      const savedTheme = localStorage.getItem(themeKey) || localStorage.getItem('elite_coach_theme') || 'dark';
      setTheme(savedTheme);
      if (savedTheme === 'light') {
        document.documentElement.classList.add('light-theme');
      } else {
        document.documentElement.classList.remove('light-theme');
      }
    }
  }, [currentUser]);

  const handleCopyCredentials = (u: User) => {
    const isLast = lastCreatedUser && lastCreatedUser.username === (u.username || u.email);
    const passwordToShow = isLast ? lastCreatedUser.password : '********';
    
    const text = `Elite Coach - Credenciais de Acesso\n` +
      `Nome: ${u.name}\n` +
      `Perfil: ${u.role}\n` +
      `Usuário/E-mail: ${u.username || u.email}\n` +
      `Senha: ${passwordToShow}\n` +
      `Link de Acesso: ${window.location.origin}`;

    navigator.clipboard.writeText(text).then(() => {
      showCustomAlert('Sucesso', 'Credenciais copiadas com sucesso!', 'success');
    }).catch(err => {
      console.error('Could not copy text: ', err);
      showCustomAlert('Erro', 'Não foi possível copiar automaticamente.', 'error');
    });
  };

  const [botToken, setBotToken] = useState<string>('');
  const [adminChatId, setAdminChatId] = useState<string>('');
  const [showToken, setShowToken] = useState<boolean>(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testMessage, setTestMessage] = useState<string>('');
  const [savingToken, setSavingToken] = useState<boolean>(false);
  const [dbWarning, setDbWarning] = useState<string>('');
  
  const [profile, setProfile] = useState<ProfileConfig>(() => {
    if (brandSettings) {
      return {
        name: brandSettings.name || 'Elite Coach',
        email: brandSettings.email || 'miller@elitecoach.com',
        specialty: brandSettings.specialty || 'Premium',
        instagram: brandSettings.instagram || '@elitecoach',
        whatsapp: brandSettings.whatsapp || '+55 11 99999-9999',
        logoUrl: brandSettings.logoUrl || '/logo.png',
        pdfTemplate: brandSettings.pdfTemplate || '1',
        colorPrimary: brandSettings.colorPrimary || '#d4af37',
        colorPrimaryDim: brandSettings.colorPrimaryDim || '#b5952f',
        colorSurface: brandSettings.colorSurface || '#0a1410',
        colorSurfaceContainer: brandSettings.colorSurfaceContainer || '#12241c',
        colorSurfaceHigh: brandSettings.colorSurfaceHigh || '#1a3428',
        colorSurfaceHighest: brandSettings.colorSurfaceHighest || '#224233',
        fontTitle: brandSettings.fontTitle || 'Montserrat',
        fontBody: brandSettings.fontBody || 'Inter',
        textScale: brandSettings.textScale || 'Padrão',
        borderRadius: brandSettings.borderRadius || 'Moderno'
      };
    }
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('elite_coach_profile');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Error parsing profile', e);
        }
      }
    }
    return {
      name: 'Elite Coach',
      email: 'miller@elitecoach.com',
      specialty: 'Premium',
      instagram: '@elitecoach',
      whatsapp: '+55 11 99999-9999',
      logoUrl: '/logo.png',
      pdfTemplate: '1',
      colorPrimary: '#d4af37',
      colorPrimaryDim: '#b5952f',
      colorSurface: '#0a1410',
      colorSurfaceContainer: '#12241c',
      colorSurfaceHigh: '#1a3428',
      colorSurfaceHighest: '#224233',
      fontTitle: 'Montserrat',
      fontBody: 'Inter',
      textScale: 'Padrão',
      borderRadius: 'Moderno'
    };
  });

  useEffect(() => {
    if (brandSettings) {
      setProfile({
        name: brandSettings.name || 'Elite Coach',
        email: brandSettings.email || 'miller@elitecoach.com',
        specialty: brandSettings.specialty || 'Premium',
        instagram: brandSettings.instagram || '@elitecoach',
        whatsapp: brandSettings.whatsapp || '+55 11 99999-9999',
        logoUrl: brandSettings.logoUrl || '/logo.png',
        pdfTemplate: brandSettings.pdfTemplate || '1',
        colorPrimary: brandSettings.colorPrimary || '#d4af37',
        colorPrimaryDim: brandSettings.colorPrimaryDim || '#b5952f',
        colorSurface: brandSettings.colorSurface || '#0a1410',
        colorSurfaceContainer: brandSettings.colorSurfaceContainer || '#12241c',
        colorSurfaceHigh: brandSettings.colorSurfaceHigh || '#1a3428',
        colorSurfaceHighest: brandSettings.colorSurfaceHighest || '#224233',
        fontTitle: brandSettings.fontTitle || 'Montserrat',
        fontBody: brandSettings.fontBody || 'Inter',
        textScale: brandSettings.textScale || 'Padrão',
        borderRadius: brandSettings.borderRadius || 'Moderno'
      });
    }
  }, [brandSettings]);

  const [extractedPrimary, setExtractedPrimary] = useState<string>('#d4af37');
  const [extractedPrimaryDim, setExtractedPrimaryDim] = useState<string>('#b5952f');
  const [activeThemeName, setActiveThemeName] = useState<string>('Clássico Elite');

  // Load fonts helper
  const loadGoogleFont = (fontName: string) => {
    if (typeof window === 'undefined') return;
    const id = `gfont-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}:wght@300;400;500;600;700;800;900&display=swap`;
    document.head.appendChild(link);
  };

  const hslToHex = (h: number, s: number, l: number) => {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p: number, q: number, t: number) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    const toHex = (x: number) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  const generateThemesFromPrimary = (primaryColor: string, primaryDimColor: string) => {
    let rVal = parseInt(primaryColor.slice(1, 3), 16) / 255;
    let gVal = parseInt(primaryColor.slice(3, 5), 16) / 255;
    let bVal = parseInt(primaryColor.slice(5, 7), 16) / 255;

    let max = Math.max(rVal, gVal, bVal), min = Math.min(rVal, gVal, bVal);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      let d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case rVal: h = (gVal - bVal) / d + (gVal < bVal ? 6 : 0); break;
        case gVal: h = (bVal - rVal) / d + 2; break;
        case bVal: h = (rVal - gVal) / d + 4; break;
      }
      h /= 6;
    }

    return {
      immersivo: {
        name: 'Imersivo Premium',
        primary: primaryColor,
        primaryDim: primaryDimColor,
        surface: hslToHex(h, 0.25, 0.05),
        surfaceContainer: hslToHex(h, 0.20, 0.09),
        surfaceHigh: hslToHex(h, 0.18, 0.14),
        surfaceHighest: hslToHex(h, 0.15, 0.20),
        secondary: hslToHex((h + 0.5) % 1, 0.25, 0.25),
        tertiary: hslToHex((h + 0.15) % 1, 0.40, 0.75),
        neutral: hslToHex(h, 0.05, 0.45)
      },
      minimalista: {
        name: 'Minimalista Escuro',
        primary: primaryColor,
        primaryDim: primaryDimColor,
        surface: '#09090b',
        surfaceContainer: '#18181b',
        surfaceHigh: '#27272a',
        surfaceHighest: '#3f3f46',
        secondary: '#52525b',
        tertiary: '#a1a1aa',
        neutral: '#71717a'
      },
      esportivo: {
        name: 'Esportivo Vibrante',
        primary: primaryColor,
        primaryDim: primaryDimColor,
        surface: '#020617',
        surfaceContainer: '#0f172a',
        surfaceHigh: '#1e293b',
        surfaceHighest: '#334155',
        secondary: '#475569',
        tertiary: '#94a3b8',
        neutral: '#64748b'
      },
      classico: {
        name: 'Clássico Elite',
        primary: '#d4af37',
        primaryDim: '#b5952f',
        surface: '#0a1410',
        surfaceContainer: '#12241c',
        surfaceHigh: '#1a3428',
        surfaceHighest: '#224233',
        secondary: '#1a2238',
        tertiary: '#ffd5ae',
        neutral: '#6e7a6a'
      }
    };
  };

  const themes = generateThemesFromPrimary(extractedPrimary, extractedPrimaryDim);

  const selectTheme = (themeKey: 'immersivo' | 'minimalista' | 'esportivo' | 'classico') => {
    const selected = themes[themeKey];
    setActiveThemeName(selected.name);
    setProfile(prev => ({
      ...prev,
      colorPrimary: selected.primary,
      colorPrimaryDim: selected.primaryDim,
      colorSurface: selected.surface,
      colorSurfaceContainer: selected.surfaceContainer,
      colorSurfaceHigh: selected.surfaceHigh,
      colorSurfaceHighest: selected.surfaceHighest
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result as string;
      setProfile(prev => ({ ...prev, logoUrl: base64Data }));
      
      const img = new Image();
      img.src = base64Data;
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          canvas.width = 30;
          canvas.height = 30;
          ctx.drawImage(img, 0, 0, 30, 30);
          const imgData = ctx.getImageData(0, 0, 30, 30).data;
          
          let rSum = 0, gSum = 0, bSum = 0, count = 0;
          for (let i = 0; i < imgData.length; i += 4) {
            const r = imgData[i];
            const g = imgData[i+1];
            const b = imgData[i+2];
            const a = imgData[i+3];
            if (a < 150) continue;
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            if (max - min > 15) {
              rSum += r;
              gSum += g;
              bSum += b;
              count++;
            }
          }
          
          let primaryHex = '#d4af37';
          if (count > 0) {
            const rAvg = Math.round(rSum / count);
            const gAvg = Math.round(gSum / count);
            const bAvg = Math.round(bSum / count);
            primaryHex = '#' + [rAvg, gAvg, bAvg].map(x => {
              const hex = x.toString(16);
              return hex.length === 1 ? '0' + hex : hex;
            }).join('');
          } else {
            let rTotal = 0, gTotal = 0, bTotal = 0, totalCount = 0;
            for (let i = 0; i < imgData.length; i += 4) {
              const r = imgData[i];
              const g = imgData[i+1];
              const b = imgData[i+2];
              const a = imgData[i+3];
              if (a >= 200 && r > 30 && r < 230) {
                rTotal += r;
                gTotal += g;
                bTotal += b;
                totalCount++;
              }
            }
            if (totalCount > 0) {
              const rAvg = Math.round(rTotal / totalCount);
              const gAvg = Math.round(gTotal / totalCount);
              const bAvg = Math.round(bTotal / totalCount);
              primaryHex = '#' + [rAvg, gAvg, bAvg].map(x => {
                const hex = x.toString(16);
                return hex.length === 1 ? '0' + hex : hex;
              }).join('');
            }
          }

          const rVal = parseInt(primaryHex.slice(1, 3), 16);
          const gVal = parseInt(primaryHex.slice(3, 5), 16);
          const bVal = parseInt(primaryHex.slice(5, 7), 16);
          const darken = (c: number) => Math.max(0, Math.round(c * 0.82));
          const dimHex = '#' + [darken(rVal), darken(gVal), darken(bVal)].map(x => {
            const hex = x.toString(16);
            return hex.length === 1 ? '0' + hex : hex;
          }).join('');

          setExtractedPrimary(primaryHex);
          setExtractedPrimaryDim(dimHex);

          const updatedThemes = generateThemesFromPrimary(primaryHex, dimHex);
          setActiveThemeName(updatedThemes.immersivo.name);
          setProfile(prev => ({
            ...prev,
            colorPrimary: updatedThemes.immersivo.primary,
            colorPrimaryDim: updatedThemes.immersivo.primaryDim,
            colorSurface: updatedThemes.immersivo.surface,
            colorSurfaceContainer: updatedThemes.immersivo.surfaceContainer,
            colorSurfaceHigh: updatedThemes.immersivo.surfaceHigh,
            colorSurfaceHighest: updatedThemes.immersivo.surfaceHighest
          }));
          showCustomAlert('IA Coleta', 'Cores extraídas da logo com sucesso! 4 Temas premium gerados e visualizáveis no dashboard.', 'success');
        } catch (err) {
          console.error(err);
        }
      };
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    if (profile.colorPrimary) {
      setExtractedPrimary(profile.colorPrimary);
      if (profile.colorPrimaryDim) {
        setExtractedPrimaryDim(profile.colorPrimaryDim);
      }
    }
  }, [profile.colorPrimary]);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);
  const [exerciseLibrary, setExerciseLibrary] = useState<any[]>([]);

  const fetchExerciseLibrary = async () => {
    try {
      const { data } = await supabase
        .from('exercise_library')
        .select('*');
      if (data) {
        setExerciseLibrary(data);
      }
    } catch (e) {
      console.error('Error fetching exercise library:', e);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('name', { ascending: true });

      if (data) {
        setUsers(data as User[]);
      }
    } catch (e) {
      console.error('Error loading users:', e);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('workout_protocols')
        .select('*')
        .order('date', { ascending: false });

      if (data) {
        const mapped = data.map((item: any) => ({
          id: item.id,
          student: item.student_name,
          objective: item.objective,
          split: item.split,
          days: item.days,
          durationWeeks: item.duration_weeks,
          weight: item.weight,
          height: item.height,
          imc: item.imc,
          clinicalNotes: item.clinical_notes,
          needs: item.needs,
          workoutData: item.workout_data,
          date: item.date
        }));
        setHistory(mapped);
      }
    } catch (e) {
      console.error('Error loading history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchTelegramToken = async () => {
    try {
      const { data: botData, error } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'telegram_bot_token')
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST205' || error.message?.includes('relation "public.system_settings" does not exist')) {
          setDbWarning('A tabela public.system_settings não existe no Supabase. Execute o script SQL no Supabase para criar.');
        } else {
          console.error('Error fetching bot token:', error);
        }
      } else if (botData?.value) {
        setBotToken(botData.value);
      }

      const { data: adminData } = await supabase
        .from('system_settings')
        .select('value')
        .eq('key', 'telegram_admin_chat_id')
        .maybeSingle();
      if (adminData?.value) {
        setAdminChatId(adminData.value);
      }
    } catch (e: any) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchHistory();
    fetchTelegramToken();
    fetchExerciseLibrary();
  }, []);

  const saveProfile = async () => {
    try {
      localStorage.setItem('elite_coach_profile', JSON.stringify(profile));

      const settingsToUpsert = [
        { key: 'brand_name', value: profile.name || 'Elite Coach' },
        { key: 'brand_specialty', value: profile.specialty || 'Premium' },
        { key: 'brand_instagram', value: profile.instagram || '@elitecoach' },
        { key: 'brand_whatsapp', value: profile.whatsapp || '+55 11 99999-9999' },
        { key: 'brand_logo_url', value: profile.logoUrl || '/logo.png' },
        { key: 'brand_pdf_template', value: profile.pdfTemplate || '1' },
        { key: 'brand_color_primary', value: profile.colorPrimary || '#d4af37' },
        { key: 'brand_color_primary_dim', value: profile.colorPrimaryDim || '#b5952f' },
        { key: 'brand_color_surface', value: profile.colorSurface || '#0a1410' },
        { key: 'brand_color_surface_container', value: profile.colorSurfaceContainer || '#12241c' },
        { key: 'brand_color_surface_high', value: profile.colorSurfaceHigh || '#1a3428' },
        { key: 'brand_color_surface_highest', value: profile.colorSurfaceHighest || '#224233' },
        { key: 'brand_font_title', value: profile.fontTitle || 'Montserrat' },
        { key: 'brand_font_body', value: profile.fontBody || 'Inter' },
        { key: 'brand_text_scale', value: profile.textScale || 'Padrão' },
        { key: 'brand_border_radius', value: profile.borderRadius || 'Moderno' }
      ];

      const { error } = await supabase.from('system_settings').upsert(settingsToUpsert);

      if (error) {
        console.error('Error saving settings to Supabase:', error);
        showCustomAlert('Erro', 'As configurações foram salvas localmente, mas não puderam ser gravadas no banco de dados.', 'warning');
      } else {
        showCustomAlert('Sucesso', 'Configurações e temas salvos e aplicados com sucesso!', 'success');
      }

      if (fetchBrandSettings) {
        await fetchBrandSettings();
      }
    } catch (e: any) {
      console.error(e);
      showCustomAlert('Erro', 'Ocorreu um erro inesperado ao salvar.', 'error');
    }
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!currentUser) return;
    
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64Data = reader.result as string;
      try {
        const { error } = await supabase
          .from('profiles')
          .update({ avatar_url: base64Data })
          .eq('id', currentUser.id);

        if (error) {
          showCustomAlert('Erro', 'Erro ao salvar foto de perfil: ' + error.message, 'error');
        } else {
          const updatedUser = { ...currentUser, avatar_url: base64Data };
          if (onUserUpdate) onUserUpdate(updatedUser);
          showCustomAlert('Sucesso', 'Foto do perfil atualizada com sucesso!', 'success');
        }
      } catch (err: any) {
        console.error(err);
        showCustomAlert('Erro', 'Erro inesperado ao salvar foto do perfil.', 'error');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteAvatar = async () => {
    if (!currentUser) return;
    showCustomAlert(
      'Confirmar Remoção',
      'Tem certeza que deseja remover sua foto de perfil?',
      'confirm',
      'Foto de Perfil',
      async () => {
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ avatar_url: null })
            .eq('id', currentUser.id);

          if (error) {
            showCustomAlert('Erro', 'Erro ao remover foto: ' + error.message, 'error');
          } else {
            const updatedUser = { ...currentUser, avatar_url: undefined };
            if (onUserUpdate) onUserUpdate(updatedUser);
            showCustomAlert('Sucesso', 'Foto do perfil removida com sucesso!', 'success');
          }
        } catch (err: any) {
          console.error(err);
          showCustomAlert('Erro', 'Erro inesperado ao remover foto.', 'error');
        }
      }
    );
  };

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    const themeKey = currentUser?.id ? `elite_coach_theme_${currentUser.id}` : 'elite_coach_theme';
    localStorage.setItem(themeKey, newTheme);
    localStorage.setItem('elite_coach_theme', newTheme);
    if (newTheme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  };

  const handleAdd = async () => {
    if(newUser.name && newUser.email) {
      if(!newUser.password) {
        return showCustomAlert('Aviso', 'Defina uma senha para o novo membro.', 'warning');
      }
      try {
        // Sign up user in Supabase auth (it creates a user entry in auth.users)
        const { data, error } = await supabase.auth.signUp({
          email: newUser.email,
          password: newUser.password,
          options: {
            data: {
              name: newUser.name,
              role: newUser.role
            }
          }
        });

        if (error) {
          let errorMsg = error.message;
          const lowerMsg = error.message.toLowerCase();
          if (lowerMsg.includes('already registered') || 
              lowerMsg.includes('already exists') || 
              lowerMsg.includes('registered') || 
              lowerMsg.includes('user-already-exists') || 
              error.status === 422) {
            
            // Check if profile exists in profiles table
            const { data: existingProfile } = await supabase
              .from('profiles')
              .select('id')
              .eq('email', newUser.email)
              .maybeSingle();

            if (!existingProfile) {
              // The profile is missing! Let's sync it via RPC
              const { data: rpcData, error: rpcError } = await supabase.rpc('sync_profile_by_email', {
                p_email: newUser.email,
                p_name: newUser.name,
                p_role: newUser.role,
                p_expires_at: newUser.expires_at ? new Date(newUser.expires_at).toISOString() : null
              });

              if (!rpcError && rpcData?.success) {
                showCustomAlert('Sucesso', 'Membro sincronizado e registrado com sucesso!', 'success');
                setNewUser({ name: '', email: '', role: 'Treinador', password: '', expires_at: '', username: '' });
                setAdding(false);
                fetchUsers();
                return;
              } else {
                console.error('RPC Error syncing profile:', rpcError || rpcData?.message);
                errorMsg = 'Este e-mail está cadastrado no Supabase Auth, mas sem perfil correspondente. Execute o script SQL no painel do Supabase para corrigir esta anomalia.';
              }
            } else {
              errorMsg = 'Este e-mail já está cadastrado no sistema! Use outro e-mail ou remova o membro anterior.';
            }
          }
          return showCustomAlert('Erro', 'Erro ao registrar usuário: ' + errorMsg, 'error');
        }

        if (data.user) {
          // Upsert into profiles to set role, expires_at, etc., even if DB trigger is active
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: data.user.id,
              name: newUser.name,
              email: newUser.email,
              role: newUser.role,
              unremovable: false,
              expires_at: newUser.expires_at ? new Date(newUser.expires_at).toISOString() : null,
              username: newUser.username ? newUser.username.toLowerCase().trim() : null
            }, { onConflict: 'id' });

          if (profileError) {
             console.error('Error upserting profile details:', profileError.message);
          }
          setLastCreatedUser({
            name: newUser.name,
            username: newUser.username ? newUser.username.toLowerCase().trim() : newUser.email,
            password: newUser.password,
            role: newUser.role
          });
        }

        showCustomAlert('Sucesso', 'Membro registrado com sucesso! Um e-mail de confirmação foi disparado.', 'success');
        setNewUser({ name: '', email: '', role: 'Treinador', password: '', expires_at: '', username: '' });
        setAdding(false);
        fetchUsers();
      } catch (err: any) {
        showCustomAlert('Erro', 'Erro ao registrar: ' + err.message, 'error');
      }
    }
  };

  const startEdit = (u: User) => {
    setEditingId(u.id);
    setEditForm({ ...u });
    setAdding(false);
  };
  
  const saveEdit = async () => {
    if(editForm && editForm.name && editForm.email) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update({
            name: editForm.name,
            email: editForm.email,
            role: editForm.role,
            expires_at: editForm.expires_at ? new Date(editForm.expires_at).toISOString() : null,
            username: editForm.username ? editForm.username.toLowerCase().trim() : null
          })
          .eq('id', editingId);


        if (error) {
          showCustomAlert('Erro', 'Erro ao atualizar perfil: ' + error.message, 'error');
        } else {
          setEditingId(null);
          setEditForm(null);
          fetchUsers();
          showCustomAlert('Sucesso', 'Perfil atualizado com sucesso!', 'success');
        }
      } catch (err: any) {
        console.error(err);
        showCustomAlert('Erro', 'Erro inesperado ao atualizar perfil.', 'error');
      }
    }
  };

  const removeUser = async (id: string | number) => {
    const userObj = users.find(u => u.id === id);
    if (userObj && userObj.role === 'Desenvolvedor') {
      showCustomAlert('Acesso Negado', 'Um usuário com perfil de Desenvolvedor não pode ser removido do sistema.', 'error');
      return;
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);

      if (error) {
        showCustomAlert('Erro', 'Erro ao remover usuário: ' + error.message, 'error');
      } else {
        fetchUsers();
        showCustomAlert('Sucesso', 'Usuário removido com sucesso!', 'success');
      }
    } catch (e) {
      console.error(e);
      showCustomAlert('Erro', 'Erro inesperado ao remover usuário.', 'error');
    }
  };

  const tryRemoveUser = (u: User) => {
    if (u.role === 'Desenvolvedor') {
      showCustomAlert('Acesso Negado', 'Um usuário com perfil de Desenvolvedor não pode ser removido do sistema.', 'error');
      return;
    }
    showCustomAlert(
      'Confirmar Exclusão',
      '',
      'confirm',
      u.name,
      () => removeUser(u.id)
    );
  };

  const handleSaveToken = async () => {
    setSavingToken(true);
    setDbWarning('');
    try {
      const { error: botError } = await supabase
        .from('system_settings')
        .upsert({ key: 'telegram_bot_token', value: botToken, updated_at: new Date().toISOString() });

      const { error: adminError } = await supabase
        .from('system_settings')
        .upsert({ key: 'telegram_admin_chat_id', value: adminChatId, updated_at: new Date().toISOString() });

      if (botError || adminError) {
        const errorMsg = (botError || adminError)?.message;
        if ((botError || adminError)?.code === 'PGRST205' || errorMsg?.includes('relation "public.system_settings" does not exist')) {
          setDbWarning('Erro ao salvar: a tabela public.system_settings não existe no banco.');
        } else {
          showCustomAlert('Erro', 'Erro ao salvar configurações: ' + errorMsg, 'error');
        }
      } else {
        showCustomAlert('Sucesso', 'Configurações do Telegram salvas com sucesso!', 'success');
      }
    } catch (e: any) {
      console.error(e);
      showCustomAlert('Erro', 'Erro inesperado ao salvar configurações.', 'error');
    } finally {
      setSavingToken(false);
    }
  };

  const handleSaveTelegramTokenResult = (err?: any) => {
     // placeholder
  };

  const handleTestConnection = async () => {
    if (!botToken) {
      showCustomAlert('Aviso', 'Digite o token do bot para testar.', 'warning');
      return;
    }
    setTestStatus('testing');
    setTestMessage('');
    try {
      const res = await fetch('/api/telegram/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: botToken })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setTestStatus('success');
        setTestMessage(`Conectado ao bot: @${data.bot.username}`);
      } else {
        setTestStatus('failed');
        setTestMessage(data.error || 'Falha na conexão com o bot.');
      }
    } catch (err: any) {
      setTestStatus('failed');
      setTestMessage(err.message || 'Erro de rede ao testar.');
    }
  };

  const visibleUsers = users.filter(u => u.role !== 'Desenvolvedor' || currentUser?.role === 'Desenvolvedor');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-heading font-bold text-white">Configurações e Histórico</h2>
        <div className="flex items-center gap-4 text-zinc-400">
           <button className="hover:text-white transition-colors"><Zap className="w-5 h-5"/></button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Settings */}
        <div className="bg-surface-container border border-surface-highest rounded-xl p-8">
           <h3 className="font-heading font-semibold text-lg text-white mb-6 border-b border-surface-highest pb-2 flex items-center gap-2">
             <Users className="w-5 h-5 text-primary"/> Configurações do Perfil e Relatórios
           </h3>
           <div className="space-y-4">
              {/* Avatar Upload Selection */}
              <div className="flex items-center gap-4 mb-6 bg-surface-high/30 p-4 rounded-xl border border-surface-highest/60">
                <div className="h-16 w-16 rounded-full border-2 border-primary/40 overflow-hidden shrink-0 relative bg-surface">
                  {currentUser?.avatar_url ? (
                    <img src={currentUser.avatar_url} alt="Profile" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <div className="w-full h-full rounded-full flex items-center justify-center text-2xl font-bold text-zinc-400">
                      {currentUser?.name ? currentUser.name.charAt(0) : '?'}
                    </div>
                  )}
                </div>
                <div>
                  <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block mb-1">Foto do Perfil (Avatar)</label>
                  <div className="flex gap-2">
                    <label className="px-3 py-1.5 bg-surface border border-surface-highest hover:border-primary/50 text-zinc-300 hover:text-white rounded text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors">
                      Selecionar Foto
                      <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                    </label>
                    {currentUser?.avatar_url && (
                      <button 
                        onClick={handleDeleteAvatar}
                        className="px-3 py-1.5 bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 rounded text-xs font-bold uppercase tracking-wider transition-colors"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Nome Completo</label>
                  <div className="group relative">
                    <Info className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 cursor-help" />
                    <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-950 text-[10px] text-zinc-300 rounded border border-surface-highest shadow-xl z-50 pointer-events-none">
                      Nome do profissional exibido nos cabeçalhos e relatórios em PDF.
                    </div>
                  </div>
                </div>
                <input type="text" value={profile.name} onChange={e=>setProfile({...profile, name: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-3 mt-1 text-white text-sm outline-none focus:border-primary transition-colors" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Instagram</label>
                    <div className="group relative">
                      <Info className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 cursor-help" />
                      <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-950 text-[10px] text-zinc-300 rounded border border-surface-highest shadow-xl z-50 pointer-events-none">
                        Link ou username do Instagram profissional do treinador.
                      </div>
                    </div>
                  </div>
                  <input type="text" value={profile.instagram || ''} onChange={e=>setProfile({...profile, instagram: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-3 mt-1 text-white text-sm outline-none focus:border-primary transition-colors" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">WhatsApp</label>
                    <div className="group relative">
                      <Info className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 cursor-help" />
                      <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-950 text-[10px] text-zinc-300 rounded border border-surface-highest shadow-xl z-50 pointer-events-none">
                        Número de contato do WhatsApp exibido nas fichas.
                      </div>
                    </div>
                  </div>
                  <input type="text" value={profile.whatsapp || ''} onChange={e=>setProfile({...profile, whatsapp: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-3 mt-1 text-white text-sm outline-none focus:border-primary transition-colors" />
                </div>
              </div>
              {/* Estilo e Identidade Visual (White-Label) */}
              <div className="border-t border-surface-highest/60 pt-6 mt-6 space-y-6">
                <h4 className="font-heading font-semibold text-white text-md flex items-center gap-2">
                  🎨 Identidade Visual e Estilo da Marca
                </h4>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left Column: Controls */}
                  <div className="space-y-4">
                    {/* Logo Uploader */}
                    <div>
                      <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block mb-2">Logotipo do Sistema</label>
                      <div className="flex items-center gap-4 bg-surface-high/30 p-4 rounded-xl border border-surface-highest/60">
                        <div className="h-16 w-16 bg-surface border border-surface-highest/60 rounded flex items-center justify-center p-2 shrink-0">
                          {profile.logoUrl ? (
                            <img src={profile.logoUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
                          ) : (
                            <span className="text-xs text-zinc-500 italic">Sem Logo</span>
                          )}
                        </div>
                        <div>
                          <label className="px-3 py-1.5 bg-surface border border-surface-highest hover:border-primary/50 text-zinc-300 hover:text-white rounded text-xs font-bold uppercase tracking-wider cursor-pointer transition-colors block text-center">
                            Fazer Upload da Logo
                            <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                          </label>
                          <p className="text-[10px] text-zinc-500 mt-1">A IA extrairá a paleta de cores automaticamente.</p>
                        </div>
                      </div>
                    </div>

                    {/* Specialty */}
                    <div>
                      <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block mb-1">Especialidade / Subtítulo</label>
                      <input type="text" value={profile.specialty || ''} onChange={e=>setProfile({...profile, specialty: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-3 text-white text-sm outline-none focus:border-primary transition-colors" placeholder="Ex: High-Performance Coach" />
                    </div>

                    {/* Fonts Choice */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block mb-1">Fonte de Títulos</label>
                        <select value={profile.fontTitle || 'Montserrat'} onChange={e=>{ loadGoogleFont(e.target.value); setProfile({...profile, fontTitle: e.target.value}); }} className="w-full bg-surface-high border border-surface-highest rounded p-3 text-white text-sm outline-none focus:border-primary transition-colors">
                          <option value="Montserrat">Montserrat</option>
                          <option value="Inter">Inter</option>
                          <option value="Outfit">Outfit</option>
                          <option value="Poppins">Poppins</option>
                          <option value="Playfair Display">Playfair Display</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block mb-1">Fonte do Texto</label>
                        <select value={profile.fontBody || 'Inter'} onChange={e=>{ loadGoogleFont(e.target.value); setProfile({...profile, fontBody: e.target.value}); }} className="w-full bg-surface-high border border-surface-highest rounded p-3 text-white text-sm outline-none focus:border-primary transition-colors">
                          <option value="Inter">Inter</option>
                          <option value="Montserrat">Montserrat</option>
                          <option value="Outfit">Outfit</option>
                          <option value="Poppins">Poppins</option>
                          <option value="Playfair Display">Playfair Display</option>
                        </select>
                      </div>
                    </div>

                    {/* Scale and Radius */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block mb-1">Tamanho da Fonte (Escala)</label>
                        <select value={profile.textScale || 'Padrão'} onChange={e=>setProfile({...profile, textScale: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-3 text-white text-sm outline-none focus:border-primary transition-colors">
                          <option value="Compacto">Compacto</option>
                          <option value="Padrão">Padrão</option>
                          <option value="Grande">Grande</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block mb-1">Estilo de Arredondamento</label>
                        <select value={profile.borderRadius || 'Moderno'} onChange={e=>setProfile({...profile, borderRadius: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-3 text-white text-sm outline-none focus:border-primary transition-colors">
                          <option value="Afiado">Afiado (Quadrado)</option>
                          <option value="Moderno">Moderno (Arredondado)</option>
                          <option value="Redondo">Redondo (Pílula)</option>
                        </select>
                      </div>
                    </div>

                    {/* Modelo Visual PDF */}
                    <div>
                      <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block mb-1">Modelo Visual do Relatório PDF</label>
                      <select value={profile.pdfTemplate} onChange={e=>setProfile({...profile, pdfTemplate: e.target.value})} className="w-full bg-surface-high border border-surface-highest rounded p-3 text-white text-sm outline-none focus:border-primary transition-colors">
                        <option value="1">Modelo 1 - Clássico (Dourado/Branco)</option>
                        <option value="2">Modelo 2 - Moderno Escuro (Minimalista)</option>
                      </select>
                    </div>
                  </div>

                  {/* Right Column: Theme Selector Cards */}
                  <div className="space-y-4">
                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider block mb-1">Temas Inteligentes Extraídos</label>
                    <div className="grid grid-cols-2 gap-3">
                      {(['immersivo', 'minimalista', 'esportivo', 'classico'] as const).map((key) => {
                        const t = themes[key];
                        const isSelected = activeThemeName === t.name;
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => selectTheme(key)}
                            className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all ${
                              isSelected 
                                ? 'border-primary bg-primary/10 shadow-[0_0_15px_rgba(212,175,55,0.1)]' 
                                : 'border-surface-highest/60 bg-surface-high/30 hover:bg-surface-high'
                            }`}
                          >
                            <span className="text-[11px] font-bold text-white tracking-wide block mb-2">{t.name}</span>
                            <div className="flex gap-1">
                              <span className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: t.primary }} />
                              <span className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: t.surface }} />
                              <span className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: t.secondary }} />
                              <span className="w-4 h-4 rounded-full border border-white/10" style={{ backgroundColor: t.tertiary }} />
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="bg-surface-high/20 border border-surface-highest/40 rounded-xl p-4 text-[10px] text-zinc-400 space-y-1">
                      <p className="font-bold text-zinc-300">💡 Dica de Especialista:</p>
                      <p>O tema **Imersivo Premium** ajusta as cores do sistema exatamente com base na luminância do seu logotipo, criando uma sensação visual premium e imersiva de white-label.</p>
                    </div>
                  </div>
                </div>

                {/* Interactive Design System Preview Dashboard */}
                <div className="bg-[#0b0c10] border border-zinc-800 rounded-2xl p-6 mt-8 overflow-hidden shadow-2xl relative">
                  <div className="absolute top-2 right-4 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                    Design System Sandbox
                  </div>
                  <h5 className="font-heading font-black text-[11px] text-zinc-400 tracking-widest uppercase mb-6 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" /> Sandbox de Visualização em Tempo Real
                  </h5>

                  {/* Mini System Replica Styled via Current State Variables */}
                  <div 
                    className="rounded-xl border p-6 space-y-6 shadow-inner"
                    style={{
                      backgroundColor: profile.colorSurface || '#0a1410',
                      borderColor: profile.colorSurfaceHighest || '#224233',
                      fontFamily: `${profile.fontBody || 'Inter'}, sans-serif`
                    }}
                  >
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
                      
                      {/* Left Block: Colors swatches */}
                      <div className="space-y-4">
                        <h6 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Paletas de Cores</h6>
                        
                        {/* Primary Swatch */}
                        <div className="p-3 rounded-lg border flex flex-col justify-between" style={{ backgroundColor: profile.colorSurfaceContainer || '#12241c', borderColor: profile.colorSurfaceHighest || '#224233' }}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Primary</span>
                            <span className="text-[9px] font-mono text-zinc-400 font-bold select-all">{profile.colorPrimary}</span>
                          </div>
                          <div className="flex h-6 rounded overflow-hidden">
                            {[0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2].map((factor, idx) => (
                              <div key={idx} className="flex-1" style={{ backgroundColor: profile.colorPrimary, opacity: factor }} />
                            ))}
                          </div>
                        </div>

                        {/* Surface Swatch */}
                        <div className="p-3 rounded-lg border flex flex-col justify-between" style={{ backgroundColor: profile.colorSurfaceContainer || '#12241c', borderColor: profile.colorSurfaceHighest || '#224233' }}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Surface</span>
                            <span className="text-[9px] font-mono text-zinc-400 font-bold select-all">{profile.colorSurface}</span>
                          </div>
                          <div className="flex h-6 rounded overflow-hidden">
                            {[0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2].map((factor, idx) => (
                              <div key={idx} className="flex-1" style={{ backgroundColor: profile.colorSurface, opacity: factor }} />
                            ))}
                          </div>
                        </div>

                        {/* Secondary Swatch */}
                        <div className="p-3 rounded-lg border flex flex-col justify-between" style={{ backgroundColor: profile.colorSurfaceContainer || '#12241c', borderColor: profile.colorSurfaceHighest || '#224233' }}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[10px] font-bold text-white uppercase tracking-wider">Secondary</span>
                            <span className="text-[9px] font-mono text-zinc-400 font-bold select-all text-right">
                              {themes[activeThemeName.includes('Imersivo') ? 'immersivo' : activeThemeName.includes('Minimalista') ? 'minimalista' : activeThemeName.includes('Esportivo') ? 'esportivo' : 'classico']?.secondary || '#1a2238'}
                            </span>
                          </div>
                          <div className="flex h-6 rounded overflow-hidden">
                            {[0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.2].map((factor, idx) => (
                              <div key={idx} className="flex-1" style={{ 
                                backgroundColor: themes[activeThemeName.includes('Imersivo') ? 'immersivo' : activeThemeName.includes('Minimalista') ? 'minimalista' : activeThemeName.includes('Esportivo') ? 'esportivo' : 'classico']?.secondary || '#1a2238', 
                                opacity: factor 
                              }} />
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Middle Block: Typography & Buttons */}
                      <div className="space-y-4">
                        <h6 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Tipografia e Estados</h6>
                        
                        <div className="p-3 rounded-lg border" style={{ backgroundColor: profile.colorSurfaceContainer || '#12241c', borderColor: profile.colorSurfaceHighest || '#224233' }}>
                          <div className="flex justify-between items-center mb-1 text-[8px] text-zinc-400 font-bold uppercase tracking-wider">
                            <span>Headline</span>
                            <span>{profile.fontTitle}</span>
                          </div>
                          <span 
                            className="text-4xl block text-white font-black"
                            style={{ fontFamily: `${profile.fontTitle || 'Montserrat'}, sans-serif` }}
                          >
                            Aa
                          </span>
                        </div>

                        <div className="p-3 rounded-lg border" style={{ backgroundColor: profile.colorSurfaceContainer || '#12241c', borderColor: profile.colorSurfaceHighest || '#224233' }}>
                          <div className="flex justify-between items-center mb-1 text-[8px] text-zinc-400 font-bold uppercase tracking-wider">
                            <span>Body text</span>
                            <span>{profile.fontBody}</span>
                          </div>
                          <span 
                            className="text-4xl block text-white"
                            style={{ fontFamily: `${profile.fontBody || 'Inter'}, sans-serif` }}
                          >
                            Aa
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <button 
                            type="button"
                            className="py-2 text-[10px] font-bold uppercase tracking-wider text-center transition-all"
                            style={{
                              backgroundColor: profile.colorPrimary,
                              color: profile.colorSurface || '#0a1410',
                              borderRadius: profile.borderRadius === 'Afiado' ? '0px' : profile.borderRadius === 'Redondo' ? '9999px' : '0.5rem'
                            }}
                          >
                            Primary
                          </button>
                          
                          <button 
                            type="button"
                            className="py-2 text-[10px] font-bold uppercase tracking-wider text-center transition-all border"
                            style={{
                              backgroundColor: 'transparent',
                              borderColor: profile.colorSurfaceHighest || '#224233',
                              color: '#fff',
                              borderRadius: profile.borderRadius === 'Afiado' ? '0px' : profile.borderRadius === 'Redondo' ? '9999px' : '0.5rem'
                            }}
                          >
                            Secondary
                          </button>
                          
                          <button 
                            type="button"
                            className="py-2 text-[10px] font-bold uppercase tracking-wider text-center transition-all"
                            style={{
                              backgroundColor: '#ffffff',
                              color: '#000000',
                              borderRadius: profile.borderRadius === 'Afiado' ? '0px' : profile.borderRadius === 'Redondo' ? '9999px' : '0.5rem'
                            }}
                          >
                            Inverted
                          </button>

                          <button 
                            type="button"
                            className="py-2 text-[10px] font-bold uppercase tracking-wider text-center transition-all border"
                            style={{
                              backgroundColor: 'transparent',
                              borderColor: profile.colorPrimary,
                              color: profile.colorPrimary,
                              borderRadius: profile.borderRadius === 'Afiado' ? '0px' : profile.borderRadius === 'Redondo' ? '9999px' : '0.5rem'
                            }}
                          >
                            Outlined
                          </button>
                        </div>
                      </div>

                      {/* Right Block: Interface Widgets */}
                      <div className="space-y-4">
                        <h6 className="text-[10px] font-bold tracking-widest text-zinc-400 uppercase">Elementos de UI</h6>
                        
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-[10px] text-zinc-500">🔍</span>
                          </div>
                          <div 
                            className="w-full pl-8 pr-3 py-2 text-[9px] border text-zinc-500 font-medium select-none cursor-not-allowed"
                            style={{
                              backgroundColor: profile.colorSurfaceHigh || '#1a3428',
                              borderColor: profile.colorSurfaceHighest || '#224233',
                              borderRadius: profile.borderRadius === 'Afiado' ? '0px' : profile.borderRadius === 'Redondo' ? '9999px' : '0.5rem'
                            }}
                          >
                            Pesquisar...
                          </div>
                        </div>

                        <div className="space-y-2 p-3 rounded-lg border" style={{ backgroundColor: profile.colorSurfaceContainer || '#12241c', borderColor: profile.colorSurfaceHighest || '#224233' }}>
                          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: '75%', backgroundColor: profile.colorPrimary }} />
                          </div>
                          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: '45%', backgroundColor: themes[activeThemeName.includes('Imersivo') ? 'immersivo' : activeThemeName.includes('Minimalista') ? 'minimalista' : activeThemeName.includes('Esportivo') ? 'esportivo' : 'classico']?.secondary || '#1a2238' }} />
                          </div>
                          <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: '60%', backgroundColor: themes[activeThemeName.includes('Imersivo') ? 'immersivo' : activeThemeName.includes('Minimalista') ? 'minimalista' : activeThemeName.includes('Esportivo') ? 'esportivo' : 'classico']?.tertiary || '#ffd5ae' }} />
                          </div>
                        </div>

                        <div className="flex gap-2 justify-center">
                          <span 
                            className="w-8 h-8 rounded flex items-center justify-center text-xs"
                            style={{ 
                              backgroundColor: themes[activeThemeName.includes('Imersivo') ? 'immersivo' : activeThemeName.includes('Minimalista') ? 'minimalista' : activeThemeName.includes('Esportivo') ? 'esportivo' : 'classico']?.tertiary || '#ffd5ae', 
                              color: '#000',
                              borderRadius: profile.borderRadius === 'Afiado' ? '0px' : profile.borderRadius === 'Redondo' ? '9999px' : '0.5rem'
                            }}
                          >
                            ✏️
                          </span>
                          <span 
                            className="px-2 h-8 rounded flex items-center justify-center text-[9px] font-bold uppercase tracking-wider"
                            style={{ 
                              backgroundColor: profile.colorPrimary, 
                              color: profile.colorSurface || '#0a1410',
                              borderRadius: profile.borderRadius === 'Afiado' ? '0px' : profile.borderRadius === 'Redondo' ? '9999px' : '0.5rem'
                            }}
                          >
                            Marcador
                          </span>
                          <span 
                            className="w-8 h-8 rounded flex items-center justify-center text-xs"
                            style={{ 
                              backgroundColor: 'rgba(239, 68, 68, 0.2)', 
                              color: '#f87171',
                              borderRadius: profile.borderRadius === 'Afiado' ? '0px' : profile.borderRadius === 'Redondo' ? '9999px' : '0.5rem'
                            }}
                          >
                            🗑️
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={saveProfile} className="w-full py-4 mt-6 bg-primary text-black font-bold uppercase tracking-wider text-xs rounded border border-primary/30 hover:bg-primary-dim transition-all shadow-[0_0_20px_rgba(212,175,55,0.25)] tracking-[0.1em]">
                Salvar Configurações de Marca
              </button>
           </div>
        </div>

        {/* Bot Integration */}
        <div className="bg-surface-container border border-surface-highest rounded-xl p-8">
           <h3 className="font-heading font-semibold text-lg text-white mb-6 border-b border-surface-highest pb-2 flex items-center gap-2">
             <Zap className="w-5 h-5 text-primary"/> Integração de Bot
           </h3>
           <p className="text-sm text-zinc-400 mb-6">Conecte seu bot do Telegram para automatizar notificações para clientes, lembretes de treinos e check-ins de progresso.</p>
           
           {dbWarning && (
             <div className="p-3 mb-4 bg-red-950/40 border border-red-500/30 text-red-300 text-xs rounded">
               ⚠️ {dbWarning}
             </div>
           )}

           <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Token do Bot do Telegram</label>
                    <div className="group relative">
                      <Info className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 cursor-help" />
                      <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-950 text-[10px] text-zinc-300 rounded border border-surface-highest shadow-xl z-50 pointer-events-none">
                        Chave do BotFather para a API do Telegram.
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowTokenGuide(!showTokenGuide)}
                    className="text-[10px] text-primary hover:underline flex items-center gap-1 font-semibold uppercase tracking-wider"
                  >
                    <HelpCircle className="w-3 h-3" /> Como obter?
                  </button>
                </div>
                <div className="relative mt-1">
                  <input 
                    type={showToken ? "text" : "password"} 
                    value={botToken} 
                    onChange={e=>setBotToken(e.target.value)} 
                    className="w-full bg-surface-high border border-surface-highest rounded p-3 pr-10 text-white text-sm outline-none focus:border-primary transition-colors font-mono" 
                    placeholder="Ex: 123456789:AABBCCDDEEFF..."
                  />
                  <button onClick={() => setShowToken(!showToken)} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
                     <Settings className="w-4 h-4"/>
                  </button>
                </div>

                <AnimatePresence>
                  {showTokenGuide && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: 'auto' }} 
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 bg-surface p-3 rounded border border-surface-highest text-xs text-zinc-300 space-y-2 overflow-hidden"
                    >
                      <p className="font-bold text-primary">Passo a passo para obter o Token:</p>
                      <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                        <li>Abra o Telegram e busque pelo contato oficial <strong className="text-white">@BotFather</strong>.</li>
                        <li>Inicie o chat e envie o comando <code className="text-primary font-mono bg-zinc-900 px-1 py-0.5 rounded">/newbot</code>.</li>
                        <li>Escolha um nome e um username para o seu bot (deve terminar em &quot;bot&quot;).</li>
                        <li>O @BotFather enviará uma mensagem de sucesso contendo o Token HTTP (ex: <code className="text-white font-mono break-all bg-zinc-900 px-1 py-0.5 rounded">123456789:ABC...</code>). Copie e cole no campo acima.</li>
                      </ol>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">Chat ID do Administrador (Telegram)</label>
                    <div className="group relative">
                      <Info className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 cursor-help" />
                      <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-950 text-[10px] text-zinc-300 rounded border border-surface-highest shadow-xl z-50 pointer-events-none">
                        Código do usuário que receberá as mensagens.
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowChatIdGuide(!showChatIdGuide)}
                    className="text-[10px] text-primary hover:underline flex items-center gap-1 font-semibold uppercase tracking-wider"
                  >
                    <HelpCircle className="w-3 h-3" /> Como obter?
                  </button>
                </div>
                <input 
                  type="text" 
                  value={adminChatId} 
                  onChange={e=>setAdminChatId(e.target.value)} 
                  className="w-full bg-surface-high border border-surface-highest rounded p-3 mt-1 text-white text-sm outline-none focus:border-primary transition-colors font-mono" 
                  placeholder="Ex: 987654321"
                />

                <AnimatePresence>
                  {showChatIdGuide && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }} 
                      animate={{ opacity: 1, height: 'auto' }} 
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-2 bg-surface p-3 rounded border border-surface-highest text-xs text-zinc-300 space-y-2 overflow-hidden"
                    >
                      <p className="font-bold text-primary">Passo a passo para obter seu Chat ID:</p>
                      <ol className="list-decimal list-inside space-y-1 text-zinc-400">
                        <li>Abra o Telegram e busque pelo seu bot recém-criado.</li>
                        <li>Envie a mensagem <code className="text-primary font-mono bg-zinc-900 px-1 py-0.5 rounded">/start</code> para iniciar a conversa.</li>
                        <li>Agora busque pelo contato oficial <strong className="text-white">@userinfobot</strong> e clique em começar.</li>
                        <li>Ele retornará uma mensagem contendo seu <strong className="text-white">Id</strong> (ex: <code className="text-white font-mono bg-zinc-900 px-1 py-0.5 rounded">987654321</code>). Copie e cole no campo acima.</li>
                      </ol>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-surface-high border border-surface-highest rounded">
                 <div>
                    <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Status</div>
                    {testStatus === 'idle' && <div className="text-sm font-medium text-zinc-400">Não testado recentemente</div>}
                    {testStatus === 'testing' && <div className="text-sm font-medium text-amber-400 animate-pulse">Testando conexão...</div>}
                    {testStatus === 'success' && <div className="text-sm font-medium text-[#00ff41]">{testMessage}</div>}
                    {testStatus === 'failed' && <div className="text-sm font-medium text-red-400">{testMessage}</div>}
                 </div>
                 <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                   testStatus === 'success' ? 'bg-[#00ff41]/20 border border-[#00ff41]/40' :
                   testStatus === 'failed' ? 'bg-red-500/20 border border-red-500/40' :
                   testStatus === 'testing' ? 'bg-amber-500/20 border border-amber-500/40' :
                   'bg-zinc-800 border border-zinc-700'
                 }`}>
                    {testStatus === 'success' && <CheckCircle2 className="w-5 h-5 text-[#00ff41]" />}
                    {testStatus === 'failed' && <X className="w-5 h-5 text-red-400" />}
                    {testStatus === 'testing' && <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />}
                    {testStatus === 'idle' && <span className="w-2 h-2 bg-zinc-500 rounded-full" />}
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleTestConnection}
                  disabled={testStatus === 'testing'}
                  className="w-full py-3 bg-surface border border-surface-highest text-zinc-300 hover:text-white font-bold uppercase tracking-wider rounded hover:border-primary/50 transition-colors disabled:opacity-50 text-xs"
                >
                  Testar
                </button>
                <button 
                  onClick={handleSaveToken}
                  disabled={savingToken}
                  className="w-full py-3 bg-primary text-black font-bold uppercase tracking-wider rounded border border-primary/30 hover:bg-primary-dim transition-colors disabled:opacity-50 text-xs shadow-[0_0_10px_rgba(212,175,55,0.2)]"
                >
                  {savingToken ? 'Salvando...' : 'Salvar Token'}
                </button>
              </div>
           </div>
        </div>

        {/* Team & Appearance */}
        <div className="bg-surface-container border border-surface-highest rounded-xl p-8 col-span-1 md:col-span-2">
          <div className="flex items-center gap-1.5 mb-6 border-b border-surface-highest pb-2">
            <h3 className="font-heading font-semibold text-lg text-white">Aparência do Sistema</h3>
            <div className="group relative">
              <Info className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 cursor-help" />
              <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-zinc-950 text-[10px] text-zinc-300 rounded border border-surface-highest shadow-xl z-50 pointer-events-none">
                Ajuste o contraste e as tonalidades do layout visual para o usuário atual.
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between bg-surface-high p-4 rounded-lg border border-surface-highest">
            <div>
              <p className="text-white font-medium">Tema Visual</p>
              <p className="text-zinc-400 text-sm">Alterne entre Dark Gold e Light Profissional</p>
            </div>
            <button 
              onClick={toggleTheme} 
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${theme === 'light' ? 'bg-primary' : 'bg-surface-highest'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${theme === 'light' ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
        </div>

        {/* System Users CRUD */}
        <div className="bg-surface-container border border-surface-highest rounded-xl p-8 col-span-1 md:col-span-2">
           <div className="flex items-center justify-between border-b border-surface-highest pb-2 mb-6">
             <h3 className="font-heading font-semibold text-lg text-white">Usuários do Sistema</h3>
             <button onClick={() => setAdding(!adding)} className="text-xs py-1 px-3 bg-surface border border-surface-highest text-primary hover:border-primary rounded font-bold uppercase transition-colors">
               {adding ? 'Cancelar' : '+ Adicionar Membro'}
             </button>
           </div>
          
         <AnimatePresence>
            {adding && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-6 bg-surface-high border border-primary/30 p-5 rounded-lg overflow-hidden relative">
                 <h4 className="text-sm font-bold text-primary mb-4 uppercase tracking-wider">Novo Usuário</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                    <div>
                      <label className="text-xs text-zinc-400 font-bold block uppercase tracking-wide">Nome</label>
                      <input type="text" value={newUser.name} onChange={e=>setNewUser({...newUser, name:e.target.value})} className="w-full bg-surface border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary" placeholder="Nome do membro" />
                    </div>
                    
                    <div>
                      <label className="text-xs text-zinc-400 font-bold block uppercase tracking-wide">E-mail</label>
                      <input type="email" value={newUser.email} onChange={e=>setNewUser({...newUser, email:e.target.value})} className="w-full bg-surface border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary" placeholder="email@exemplo.com" />
                    </div>

                    <div>
                      <label className="text-xs text-zinc-400 font-bold block uppercase tracking-wide">Nome de Usuário (Username)</label>
                      <input type="text" value={newUser.username || ''} onChange={e=>setNewUser({...newUser, username:e.target.value})} className="w-full bg-surface border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary" placeholder="Ex: coach_master" />
                    </div>

                    <div>
                      <label className="text-xs text-zinc-400 font-bold block uppercase tracking-wide">Senha de Acesso</label>
                      <div className="relative mt-1">
                        <input 
                          type={showNewUserPassword ? "text" : "password"} 
                          value={newUser.password} 
                          onChange={e=>setNewUser({...newUser, password:e.target.value})} 
                          className="w-full bg-surface border border-surface-highest rounded p-2.5 pr-10 text-white text-sm outline-none focus:border-primary" 
                          placeholder="Senha forte" 
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white transition-colors"
                        >
                          {showNewUserPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs text-zinc-400 font-bold block uppercase tracking-wide">Perfil de Acesso</label>
                      <select value={newUser.role} onChange={e=>setNewUser({...newUser, role:e.target.value})} className="w-full bg-surface border border-surface-highest rounded p-2.5 mt-1 text-white text-sm outline-none focus:border-primary">
                        <option>Treinador</option>
                        <option>Administrador</option>
                        {currentUser?.role === 'Desenvolvedor' && <option>Desenvolvedor</option>}
                      </select>
                    </div>

                    <div>
                      <label className="text-xs text-zinc-400 font-bold block uppercase tracking-wide font-sans">Temporizador / Expiração</label>
                      <input type="datetime-local" value={newUser.expires_at} onChange={e=>setNewUser({...newUser, expires_at:e.target.value})} className="w-full bg-surface border border-surface-highest rounded p-2 mt-1 text-white text-sm outline-none focus:border-primary font-mono" />
                    </div>

                    <div className="flex gap-2">
                      <button onClick={handleAdd} className="flex-1 bg-primary text-black font-bold h-[40px] px-6 rounded hover:opacity-90 transition-opacity uppercase tracking-wider text-xs">Salvar</button>
                      <button onClick={() => setAdding(false)} className="px-4 border border-surface-highest text-zinc-400 hover:text-white rounded h-[40px] text-xs font-bold uppercase tracking-wider transition-colors">Cancelar</button>
                    </div>
                 </div>
              </motion.div>
            )}
         </AnimatePresence>

         {loadingUsers ? (
            <p className="text-zinc-500 text-sm py-4 italic animate-pulse">Carregando membros da equipe...</p>
         ) : (
           <>
             {/* Desktop Table View */}
             <div className="hidden sm:block">
               <table className="w-full text-left text-sm text-zinc-300">
                 <thead className="bg-surface-high uppercase text-xs font-bold text-zinc-500">
                   <tr>
                     <th className="p-3 rounded-tl">Nome</th>
                     <th className="p-3">Usuário</th>
                     <th className="p-3">E-mail</th>
                     <th className="p-3">Acesso</th>
                     <th className="p-3">Expiração</th>
                     <th className="p-3 text-right rounded-tr">Ações</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-surface-highest">
                   {visibleUsers.map(u => (
                     <tr key={u.id} className="hover:bg-surface-high/30">
                       <td className="p-3 font-medium text-white">
                          {editingId === u.id && editForm ? <input type="text" value={editForm.name} onChange={e=>setEditForm({...editForm, name:e.target.value})} className="bg-surface border border-surface-highest rounded px-2 py-1 text-xs w-full outline-none focus:border-primary" /> : u.name}
                       </td>
                       <td className="p-3 text-zinc-300 font-mono text-xs">
                          {editingId === u.id && editForm ? <input type="text" value={editForm.username || ''} onChange={e=>setEditForm({...editForm, username:e.target.value})} className="bg-surface border border-surface-highest rounded px-2 py-1 text-xs w-full outline-none focus:border-primary" placeholder="Sem username" /> : u.username || <span className="text-zinc-600 italic">Sem Usuário</span>}
                       </td>
                       <td className="p-3 text-zinc-400">
                          {editingId === u.id && editForm ? <input type="email" value={editForm.email} onChange={e=>setEditForm({...editForm, email:e.target.value})} className="bg-surface border border-surface-highest rounded px-2 py-1 text-xs w-full outline-none focus:border-primary" /> : u.email}
                       </td>
                       <td className="p-3">
                         {editingId === u.id && editForm && u.role !== 'Desenvolvedor' ? (
                            <select value={editForm.role} onChange={e=>setEditForm({...editForm, role:e.target.value})} className="bg-surface border border-surface-highest text-white rounded px-2 py-1 text-xs w-full outline-none focus:border-primary">
                              <option>Treinador</option>
                              <option>Administrador</option>
                              {currentUser?.role === 'Desenvolvedor' && <option>Desenvolvedor</option>}
                            </select>
                         ) : (
                           <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest border ${
                             u.role === 'Desenvolvedor' ? 'bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/20' : 
                             u.role === 'Administrador' ? 'bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/20' : 
                             'bg-zinc-800 text-zinc-300 border-zinc-700'
                           }`}>{u.role}</span>
                         )}
                       </td>
                       <td className="p-3 font-mono text-xs">
                          {editingId === u.id && editForm ? (
                            <input 
                              type="datetime-local" 
                              value={editForm.expires_at ? new Date(new Date(editForm.expires_at).getTime() - new Date(editForm.expires_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} 
                              onChange={e=>setEditForm({...editForm, expires_at: e.target.value || undefined})} 
                              className="bg-surface border border-surface-highest text-white rounded px-2 py-1 text-xs outline-none focus:border-primary font-mono" 
                            />
                          ) : (
                            u.expires_at ? new Date(u.expires_at).toLocaleString('pt-BR') : <span className="text-zinc-500 italic">Sem limite</span>
                          )}
                       </td>
                       <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-4">
                            {editingId === u.id ? (
                              <>
                                <button onClick={saveEdit} className="text-[#00ff41] hover:text-[#00ff41]/80 transition-colors uppercase text-xs font-bold tracking-wider">Salvar</button>
                                <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-zinc-400 transition-colors uppercase text-xs font-bold tracking-wider">Cancelar</button>
                              </>
                            ) : (
                              <>
                                 <button 
                                   onClick={() => handleCopyCredentials(u)} 
                                   className="text-[#dfbf80] hover:text-[#dfbf80]/80 transition-colors uppercase text-xs font-bold tracking-wider flex items-center"
                                 >
                                   <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
                                 </button>
                                 <button onClick={() => startEdit(u)} className="text-[#d4af37] hover:text-[#d4af37]/80 transition-colors uppercase text-xs font-bold tracking-wider">Editar</button>
                                 {u.unremovable || u.role === 'Desenvolvedor' ? (
                                    <span className="text-xs text-zinc-600 italic">Protegido</span>
                                 ) : (
                                    <button onClick={() => tryRemoveUser(u)} className="text-zinc-500 hover:text-red-400 transition-colors uppercase text-xs font-bold tracking-wider flex items-center"><X className="w-3 h-3 mr-1" /> Remover</button>
                                 )}
                              </>
                            )}
                          </div>
                       </td>
                     </tr>
                   ))}
                 </tbody>
               </table>
             </div>

             {/* Mobile Cards View */}
             <div className="grid grid-cols-1 gap-4 sm:hidden">
               {visibleUsers.map(u => (
                 <div key={u.id} className="bg-surface-high border border-surface-highest p-4 rounded-lg flex flex-col gap-3">
                   <div className="flex justify-between items-start">
                     <div>
                        {editingId === u.id && editForm ? (
                          <div className="space-y-2 mt-1">
                            <label className="text-[10px] text-zinc-500 font-bold block uppercase">Nome</label>
                            <input type="text" value={editForm.name} onChange={e=>setEditForm({...editForm, name:e.target.value})} className="bg-surface border border-surface-highest rounded px-2 py-1 text-xs w-full outline-none focus:border-primary text-white" />
                            <label className="text-[10px] text-zinc-500 font-bold block uppercase">E-mail</label>
                            <input type="email" value={editForm.email} onChange={e=>setEditForm({...editForm, email:e.target.value})} className="bg-surface border border-surface-highest rounded px-2 py-1 text-xs w-full outline-none focus:border-primary text-white" />
                            <label className="text-[10px] text-zinc-500 font-bold block uppercase">Nome de Usuário (Username)</label>
                            <input type="text" value={editForm.username || ''} onChange={e=>setEditForm({...editForm, username:e.target.value})} className="bg-surface border border-surface-highest rounded px-2 py-1 text-xs w-full outline-none focus:border-primary text-white font-mono" placeholder="Sem username" />
                            <label className="text-[10px] text-zinc-500 font-bold block uppercase">Temporizador / Expiração</label>
                            <input 
                              type="datetime-local" 
                              value={editForm.expires_at ? new Date(new Date(editForm.expires_at).getTime() - new Date(editForm.expires_at).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} 
                              onChange={e=>setEditForm({...editForm, expires_at: e.target.value || undefined})} 
                              className="bg-surface border border-surface-highest rounded px-2 py-1 text-xs w-full outline-none focus:border-primary text-white font-mono" 
                            />
                          </div>
                        ) : (
                          <>
                            <h4 className="font-bold text-white text-sm">{u.name}</h4>
                            <span className="text-xs text-zinc-400 block mt-0.5">{u.email}</span>
                            <span className="text-[10px] text-zinc-500 block mt-0.5 font-mono">Usuário: {u.username || <span className="italic text-zinc-600">Sem usuário</span>}</span>
                            {u.expires_at && (
                              <span className="text-[10px] text-[#dfbf80] block mt-1 font-mono">Expira: {new Date(u.expires_at).toLocaleString('pt-BR')}</span>
                            )}
                          </>
                        )}
                     </div>
                     <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border shrink-0 ${
                       u.role === 'Desenvolvedor' ? 'bg-[#d4af37]/10 text-[#d4af37] border-[#d4af37]/20' : 
                       u.role === 'Administrador' ? 'bg-[#00ff41]/10 text-[#00ff41] border-[#00ff41]/20' : 
                       'bg-zinc-800 text-zinc-300 border-zinc-700'
                     }`}>{u.role}</span>
                   </div>

                   {editingId === u.id && editForm && u.role !== 'Desenvolvedor' && (
                     <div className="w-full">
                       <label className="text-[10px] text-zinc-500 font-bold block uppercase mb-1">Perfil de Acesso</label>
                       <select value={editForm.role} onChange={e=>setEditForm({...editForm, role:e.target.value})} className="bg-surface border border-surface-highest text-white rounded px-2 py-1.5 text-xs w-full outline-none focus:border-primary">
                         <option>Treinador</option>
                         <option>Administrador</option>
                         {currentUser?.role === 'Desenvolvedor' && <option>Desenvolvedor</option>}
                       </select>
                     </div>
                   )}

                   <div className="flex justify-end gap-3 border-t border-surface-highest/40 pt-3">
                     {editingId === u.id ? (
                       <>
                          <button onClick={saveEdit} className="text-[#00ff41] hover:text-[#00ff41]/80 transition-colors uppercase text-xs font-bold tracking-wider">Salvar</button>
                          <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-zinc-400 transition-colors uppercase text-xs font-bold tracking-wider">Cancelar</button>
                       </>
                     ) : (
                       <>
                          <button onClick={() => startEdit(u)} className="text-[#d4af37] hover:text-[#d4af37]/80 transition-colors uppercase text-xs font-bold tracking-wider">Editar</button>
                          {u.unremovable || u.role === 'Desenvolvedor' ? (
                             <span className="text-xs text-zinc-600 italic">Protegido</span>
                          ) : (
                             <button onClick={() => tryRemoveUser(u)} className="text-zinc-500 hover:text-red-400 transition-colors uppercase text-xs font-bold tracking-wider flex items-center"><X className="w-3 h-3 mr-1" /> Remover</button>
                          )}
                       </>
                     )}
                   </div>
                 </div>
               ))}
             </div>
           </>
         )}
      </div>

      {/* Workout history from Supabase */}
      <div className="bg-surface-container border border-surface-highest rounded-xl p-4 md:p-8 col-span-1 md:col-span-2">
         <div className="flex items-center gap-2 border-b border-surface-highest pb-2 mb-6">
            <RotateCcw className="w-5 h-5 text-primary" />
            <h3 className="font-heading font-semibold text-lg text-white">Histórico de Treinos Salvos</h3>
         </div>

         {loadingHistory ? (
           <p className="text-zinc-500 text-sm italic py-4 animate-pulse">Carregando histórico do banco de dados...</p>
         ) : history.length === 0 ? (
           <p className="text-zinc-500 text-sm italic py-4">Nenhum protocolo gerado ainda.</p>
         ) : (
           <>
             {/* Desktop Table View */}
             <div className="hidden sm:block">
               <table className="w-full text-left text-sm text-zinc-300">
                 <thead className="bg-surface-high uppercase text-xs font-bold text-zinc-500">
                   <tr>
                     <th className="p-3 rounded-tl">Data</th>
                     <th className="p-3">Nome do Aluno</th>
                     <th className="p-3">Tipo de Treino</th>
                     <th className="p-3">Status</th>
                     <th className="p-3 text-right rounded-tr">Ações</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-surface-highest">
                   {history.map(item => (
                     <tr key={item.id} className="hover:bg-surface-high/30">
                       <td className="p-3 font-medium text-white">{new Date(item.date).toISOString().split('T')[0]}</td>
                       <td className="p-3 text-zinc-100">{item.student}</td>
                       <td className="p-3 text-zinc-400 capitalize">{item.objective} {item.split}</td>
                       <td className="p-3">
                         <span className="px-2 py-1 bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/20 rounded text-[10px] font-bold uppercase tracking-widest">Concluído</span>
                       </td>
                       <td className="p-3 text-right text-zinc-500">
                         <button onClick={() => generatePDFAndShare(item, false, exerciseLibrary)} className="hover:text-primary transition-colors inline-block"><Share2 className="w-4 h-4"/></button>
                       </td>
                     </tr>
                   ))}
                 </tbody>
                </table>
             </div>

             {/* Mobile Cards View */}
             <div className="grid grid-cols-1 gap-4 sm:hidden">
               {history.map(item => (
                 <div key={item.id} className="bg-surface-high border border-surface-highest p-4 rounded-lg flex flex-col gap-2">
                   <div className="flex justify-between items-center">
                     <span className="text-[10px] text-zinc-500 uppercase font-bold">{new Date(item.date).toISOString().split('T')[0]}</span>
                     <span className="px-2 py-0.5 bg-[#00ff41]/10 text-[#00ff41] border border-[#00ff41]/20 rounded text-[9px] font-bold uppercase tracking-widest">Concluído</span>
                   </div>
                   <div className="font-bold text-white text-sm mt-1">{item.student}</div>
                   <p className="text-xs text-zinc-400 capitalize truncate" title={item.objective}>{item.objective} {item.split}</p>
                   <div className="flex justify-end mt-2 pt-2 border-t border-surface-highest/40">
                     <button onClick={() => generatePDFAndShare(item, false, exerciseLibrary)} className="flex items-center gap-1 text-primary text-xs font-bold uppercase tracking-wider">
                       <Share2 className="w-3.5 h-3.5"/> Compartilhar
                     </button>
                   </div>
                 </div>
               ))}
             </div>
           </>
          )}
       </div>
      </div>

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
