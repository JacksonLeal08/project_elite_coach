'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: (x: number, y: number) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Tenta ler o tema salvo no localStorage, caso contrário o padrão é 'dark'
    const savedTheme = (localStorage.getItem('app_theme') as Theme) || 'dark';
    setTheme(savedTheme);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    
    const root = document.documentElement;
    if (theme === 'light') {
      root.classList.add('light-theme');
      root.style.colorScheme = 'light';
    } else {
      root.classList.remove('light-theme');
      root.style.colorScheme = 'dark';
    }
    localStorage.setItem('app_theme', theme);
  }, [theme, mounted]);

  const toggleTheme = async (x: number, y: number) => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';

    // Fallback se o navegador não suportar View Transitions
    if (!document.startViewTransition) {
      setTheme(nextTheme);
      return;
    }

    const transition = document.startViewTransition(() => {
      setTheme(nextTheme);
    });

    try {
      await transition.ready;
      
      const radius = Math.hypot(
        Math.max(x, innerWidth - x),
        Math.max(y, innerHeight - y)
      );

      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${radius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 450,
          easing: 'ease-in-out',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    } catch (e) {
      // Ignora falhas de transição
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
