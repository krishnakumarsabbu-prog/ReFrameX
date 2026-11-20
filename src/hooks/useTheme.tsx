import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface ThemeState {
  reduceTransparency: boolean;
  toggleReduceTransparency: () => void;
  railExpanded: boolean;
  toggleRailExpanded: () => void;
  setRailExpanded: (v: boolean) => void;
}

const ThemeContext = createContext<ThemeState | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [reduceTransparency, setReduce] = useState<boolean>(() => {
    return localStorage.getItem('reframex-reduce-transparency') === 'true';
  });
  const [railExpanded, setRailExpanded] = useState<boolean>(() => {
    return localStorage.getItem('reframex-rail-expanded') === 'true';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-transparency', reduceTransparency);
    localStorage.setItem('reframex-reduce-transparency', String(reduceTransparency));
  }, [reduceTransparency]);

  useEffect(() => {
    localStorage.setItem('reframex-rail-expanded', String(railExpanded));
  }, [railExpanded]);

  return (
    <ThemeContext.Provider
      value={{
        reduceTransparency,
        toggleReduceTransparency: () => setReduce((v) => !v),
        railExpanded,
        toggleRailExpanded: () => setRailExpanded((v) => !v),
        setRailExpanded,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
