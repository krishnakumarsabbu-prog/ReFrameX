import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Contrast, Command, Bell, ShieldAlert } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { railItems } from '@/mock-data';

export default function TopPillBar() {
  const { reduceTransparency, toggleReduceTransparency } = useTheme();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = query
    ? railItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
    : [];

  function handleSelect(path: string) {
    navigate(path);
    setQuery('');
    setShowResults(false);
    inputRef.current?.blur();
  }

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setShowResults(false);
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  return (
    <header className="fixed top-3 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-7xl">
      <div className="glass-strong rounded-pill flex items-center gap-3 px-3 sm:px-4 py-2">
        <div className="flex items-center gap-2.5 shrink-0 min-w-0">
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-white/70 border border-white/60 text-accent font-bold text-xs shadow-sm">
            RX
          </div>
          <div className="hidden sm:block leading-tight">
            <p className="text-[10px] text-ink-soft">Welcome back</p>
            <p className="text-sm font-semibold text-ink">ReFrameX</p>
          </div>
        </div>

        <div className="flex-1 relative max-w-xl mx-auto">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              onBlur={() => setTimeout(() => setShowResults(false), 150)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && results[0]) handleSelect(results[0].path);
              }}
              placeholder="Search modules or jump to a page..."
              className="w-full pl-9 pr-16 py-2 rounded-pill inner-glass text-sm text-ink placeholder:text-ink-soft focus:bg-white/35 focus:border-accent/50 transition-colors outline-none"
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-ink/8 text-[10px] text-ink-soft font-mono">
              <Command size={10} />K
            </kbd>
          </div>
          {showResults && results.length > 0 && (
            <div className="absolute top-full mt-2 left-0 right-0 glass-strong rounded-2xl py-2 max-h-72 overflow-y-auto">
              {results.map((item) => (
                <button
                  key={item.id}
                  onMouseDown={() => handleSelect(item.path)}
                  className="w-full text-left px-4 py-2 text-sm text-ink-muted hover:bg-white/40 transition-colors"
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => navigate('/risks')}
            className="relative flex items-center justify-center w-9 h-9 rounded-full bg-white/70 text-ink hover:bg-white transition-colors shadow-sm"
            aria-label="Open risk register"
            title="Open risk register"
          >
            <Bell size={16} />
            <span className="absolute top-1 right-1 flex items-center justify-center w-3.5 h-3.5 rounded-full bg-accent text-white">
              <ShieldAlert size={9} />
            </span>
          </button>
          <button
            onClick={toggleReduceTransparency}
            className={`flex items-center justify-center w-9 h-9 rounded-full transition-colors ${
              reduceTransparency ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-white/40'
            }`}
            aria-label="Toggle reduce transparency"
            title="Reduce transparency"
          >
            <Contrast size={16} />
          </button>

        </div>
      </div>
    </header>
  );
}
