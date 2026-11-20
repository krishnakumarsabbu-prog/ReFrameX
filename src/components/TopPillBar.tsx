import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Bell, ChevronDown, Contrast, Command } from 'lucide-react';
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
    <header className="fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl">
      <div className="glass-strong rounded-bento flex items-center gap-3 px-4 py-2.5">
        {/* Logo + avatar */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-accent flex items-center justify-center text-white font-bold text-sm shadow-sm">
              RX
            </div>
            <span className="hidden md:block text-sm font-semibold text-ink">ReframeX</span>
          </div>
          <div className="hidden lg:flex items-center gap-2 pl-3 border-l border-white/30">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-200 to-orange-300 flex items-center justify-center text-xs font-semibold text-ink">
              AM
            </div>
            <span className="text-xs text-ink-muted">Welcome, Analyst</span>
          </div>
        </div>

        {/* Search / command bar */}
        <div className="flex-1 relative max-w-md mx-auto">
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
              placeholder="Search modules…"
              className="w-full pl-9 pr-16 py-2 rounded-2xl bg-white/40 border border-white/30 text-sm text-ink placeholder:text-ink-soft focus:bg-white/60 focus:border-accent/40 transition-colors outline-none"
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

        {/* Right controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={toggleReduceTransparency}
            className={`flex items-center justify-center w-8 h-8 rounded-full transition-colors ${
              reduceTransparency ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-white/40'
            }`}
            aria-label="Toggle reduce transparency"
            title="Reduce transparency"
          >
            <Contrast size={16} />
          </button>
          <button
            className="relative flex items-center justify-center w-8 h-8 rounded-full text-ink-muted hover:bg-white/40 transition-colors"
            aria-label="Notifications"
          >
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-accent" />
          </button>
          <button
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/40 hover:bg-white/60 transition-colors text-xs font-medium text-ink-muted"
            aria-label="Application selector"
          >
            All Applications
            <ChevronDown size={14} />
          </button>
          <button
            className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-amber-200 to-orange-300 text-xs font-semibold text-ink"
            aria-label="Profile"
          >
            AM
          </button>
        </div>
      </div>
    </header>
  );
}
