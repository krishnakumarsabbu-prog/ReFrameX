import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type WallpaperId = 'warm-studio' | 'sand-dune' | 'slate-dusk' | 'teal-mist' | 'custom';

interface ThemeState {
  reduceTransparency: boolean;
  toggleReduceTransparency: () => void;
  railExpanded: boolean;
  toggleRailExpanded: () => void;
  setRailExpanded: (v: boolean) => void;
  wallpaper: WallpaperId;
  setWallpaper: (wallpaper: WallpaperId) => void;
  customWallpaper: string | null;
  setCustomWallpaper: (image: string) => void;
}

const ThemeContext = createContext<ThemeState | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [reduceTransparency, setReduce] = useState<boolean>(() => localStorage.getItem('reframex-reduce-transparency') === 'true');
  const [railExpanded, setRailExpanded] = useState<boolean>(() => localStorage.getItem('reframex-rail-expanded') === 'true');
  const [wallpaper, setWallpaperState] = useState<WallpaperId>(() => {
    const stored = localStorage.getItem('reframex-wallpaper');
    return stored === 'sand-dune' || stored === 'slate-dusk' || stored === 'teal-mist' || stored === 'custom' ? stored : 'warm-studio';
  });
  const [customWallpaper, setCustomWallpaperState] = useState<string | null>(() => localStorage.getItem('reframex-custom-wallpaper'));

  useEffect(() => {
    document.documentElement.classList.toggle('reduce-transparency', reduceTransparency);
    localStorage.setItem('reframex-reduce-transparency', String(reduceTransparency));
  }, [reduceTransparency]);

  useEffect(() => {
    localStorage.setItem('reframex-rail-expanded', String(railExpanded));
  }, [railExpanded]);

  useEffect(() => {
    document.documentElement.dataset.wallpaper = wallpaper;
    document.documentElement.style.setProperty('--custom-wallpaper', customWallpaper ? `url(${customWallpaper})` : 'none');
    localStorage.setItem('reframex-wallpaper', wallpaper);
  }, [wallpaper, customWallpaper]);

  function setWallpaper(next: WallpaperId) {
    setWallpaperState(next);
  }

  function setCustomWallpaper(image: string) {
    setCustomWallpaperState(image);
    setWallpaperState('custom');
    localStorage.setItem('reframex-custom-wallpaper', image);
  }

  return (
    <ThemeContext.Provider value={{
      reduceTransparency,
      toggleReduceTransparency: () => setReduce((v) => !v),
      railExpanded,
      toggleRailExpanded: () => setRailExpanded((v) => !v),
      setRailExpanded,
      wallpaper,
      setWallpaper,
      customWallpaper,
      setCustomWallpaper,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
