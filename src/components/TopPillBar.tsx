import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Command, Bell, Menu, ChevronRight, Sparkles } from 'lucide-react';
import { railItems } from '@/mock-data';

interface TopPillBarProps {
  onOpenMobileNav?: () => void;
}

export default function TopPillBar({ onOpenMobileNav }: TopPillBarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentModule = railItems.find(
    (item) => item.path === location.pathname || (item.path !== '/' && location.pathname.startsWith(item.path))
  );

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
    <header className="sticky top-0 z-30 h-14 border-b border-[#E3E5E7] bg-white/85 backdrop-blur-md">
      <div className="flex h-full items-center justify-between gap-3 px-4 sm:px-8 lg:px-10">
        {/* Left Side: Mobile Menu Button & Breadcrumb */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobileNav}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#E3E5E7] text-[#777D83] transition-colors hover:bg-[#F1F2F3] hover:text-[#202124] md:hidden"
            aria-label="Open navigation"
          >
            <Menu size={16} />
          </button>

          {/* Breadcrumb Trail */}
          <div className="hidden sm:flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.08em] text-slate-500">
            <span className="h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/25 shrink-0" />
            <span className="font-bold text-slate-800">MIGRATION INTELLIGENCE</span>
            <ChevronRight size={11} className="text-slate-300" />
            <span className="text-indigo-600 font-bold">
              {currentModule?.label.toUpperCase() ?? 'OVERVIEW'}
            </span>
          </div>
        </div>

        {/* Center: Command Palette Search */}
        <div className="relative w-full max-w-sm sm:max-w-md">
          <div className="relative">
            <Search
              size={14}
              strokeWidth={2}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A0A4A8]"
            />
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
              placeholder="Search artifacts, applications, rules... ⌘K"
              aria-label="Search modules"
              className="h-8 w-full rounded-xl border border-[#E3E5E7] bg-[#F1F2F3] pl-8 pr-14 text-xs text-[#202124] placeholder:text-[#A0A4A8] outline-none transition-all focus:border-[#202124] focus:bg-white focus:ring-2 focus:ring-[#C5F45A]/40"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 rounded-lg border border-[#E3E5E7] bg-white px-1.5 py-0.5 font-mono text-[10px] text-[#777D83]">
              <Command size={10} />K
            </kbd>
          </div>

          {/* Quick Search Dropdown */}
          {showResults && results.length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-[#E3E5E7] bg-white py-1 shadow-[0_8px_24px_rgba(25,30,35,0.08)]">
              {results.map((item) => (
                <button
                  key={item.id}
                  onMouseDown={() => handleSelect(item.path)}
                  className="w-full px-3.5 py-2 text-left text-xs text-[#777D83] transition-colors hover:bg-[#F1F2F3] hover:text-[#202124] flex items-center justify-between"
                >
                  <span className="font-medium">{item.label}</span>
                  <span className="font-mono text-[10px] text-[#A0A4A8]">{item.path}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Quick Actions & Profile */}
        <div className="flex shrink-0 items-center gap-2.5">
          {/* AI Copilot Pill */}
          <button
            onClick={() => window.dispatchEvent(new CustomEvent('toggle-reframex-chat'))}
            className="flex items-center gap-1.5 rounded-xl border border-indigo-200/80 bg-gradient-to-r from-indigo-50/90 to-blue-50/90 hover:from-indigo-100 hover:to-blue-100 px-3 py-1.5 text-xs font-semibold text-indigo-700 shadow-2xs hover:border-indigo-300 transition-all active:scale-95 group"
            aria-label="Toggle AI Copilot"
            title="Open AI Copilot (Ctrl+J)"
          >
            <Sparkles size={13} className="text-indigo-600 transition-transform group-hover:rotate-12" />
            <span className="hidden sm:inline font-sans">AI Copilot</span>
            <kbd className="hidden lg:inline-flex items-center text-[9px] font-mono font-normal text-indigo-500 bg-white/80 px-1 py-0.5 rounded border border-indigo-200/60">
              ^J
            </kbd>
          </button>

          <button
            onClick={() => navigate('/risks')}
            className="relative flex h-8 w-8 items-center justify-center rounded-xl border border-[#E3E5E7] bg-white text-[#777D83] transition-colors hover:bg-[#F1F2F3] hover:text-[#202124] shadow-[0_1px_2px_rgba(25,30,35,0.04)]"
            aria-label="Open risk register"
            title="Open risk register"
          >
            <Bell size={15} />
            <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#DC2626] text-[8px] font-bold text-white">
              5
            </span>
          </button>

          <div className="h-5 w-px bg-[#E3E5E7]" />

          {/* Minimal Architect Profile Pill */}
          <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-2.5 py-1 shadow-2xs">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-tr from-indigo-600 to-blue-600 font-mono text-[10px] font-bold text-white shadow-2xs">
              EA
            </div>
            <div className="hidden lg:block text-left leading-tight">
              <p className="font-sans text-[11px] font-bold text-slate-800">Enterprise Architect</p>
              <p className="font-mono text-[9px] text-slate-500 font-medium">PROD · REFRAMEX</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
