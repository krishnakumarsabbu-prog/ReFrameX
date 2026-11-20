import { NavLink } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { railItems } from '@/mock-data';

export default function GlassRail() {
  const { railExpanded, toggleRailExpanded } = useTheme();

  return (
    <aside
      className={`fixed left-4 top-1/2 -translate-y-1/2 z-40 glass-strong rounded-bento py-3 transition-all duration-200 ${
        railExpanded ? 'w-52 px-3' : 'w-16 px-2'
      }`}
    >
      <div className="flex flex-col gap-1">
        {railItems.map((item) => {
          const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[item.icon] ?? Icons.Circle;
          return (
            <NavLink
              key={item.id}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-2xl transition-all duration-200 ${
                  railExpanded ? 'px-3 py-2.5' : 'px-2 py-2.5 justify-center'
                } ${isActive ? 'bg-white/80 shadow-sm' : 'hover:bg-white/40'}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && !railExpanded && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 rounded-full bg-accent" />
                  )}
                  <span
                    className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${
                      isActive ? 'bg-accent text-white' : 'text-ink-muted group-hover:text-ink'
                    }`}
                  >
                    <Icon size={18} strokeWidth={2} />
                  </span>
                  {railExpanded && (
                    <span className={`text-sm font-medium ${isActive ? 'text-ink' : 'text-ink-muted'}`}>
                      {item.label}
                    </span>
                  )}
                  {!railExpanded && (
                    <span className="absolute left-full ml-3 whitespace-nowrap px-3 py-1.5 rounded-xl bg-ink/90 text-white text-xs font-medium opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
                      {item.label}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </div>

      <button
        onClick={toggleRailExpanded}
        className={`mt-2 flex items-center justify-center w-full py-2 rounded-2xl text-ink-soft hover:bg-white/40 transition-colors ${
          railExpanded ? 'gap-2' : ''
        }`}
        aria-label={railExpanded ? 'Collapse rail' : 'Expand rail'}
      >
        {railExpanded ? <ChevronsLeft size={18} /> : <ChevronsRight size={18} />}
        {railExpanded && <span className="text-xs font-medium">Collapse</span>}
      </button>
    </aside>
  );
}
