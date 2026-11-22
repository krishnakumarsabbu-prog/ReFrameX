import { NavLink } from 'react-router-dom';
import {
  AlertTriangle, Boxes, ChevronsLeft, ChevronsRight, Columns3, FileSearch,
  FileText, FlaskConical, Gauge, GitBranch, History, LayoutDashboard,
  Layers, Lightbulb, ScrollText, Settings, Sparkles, type LucideIcon,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { railItems } from '@/mock-data';

const icons: Record<string, LucideIcon> = {
  LayoutDashboard, Boxes, Layers, FileSearch, Sparkles, GitBranch, Gauge, ScrollText,
  AlertTriangle, Lightbulb, FlaskConical, FileText, Columns3, History, Settings,
};

const groups: { label: string; ids: string[] }[] = [
  { label: 'Workspace', ids: ['dashboard', 'applications', 'overview'] },
  { label: 'Intelligence', ids: ['artifacts', 'intelligence', 'dependencies', 'complexity', 'evidence'] },
  { label: 'Governance', ids: ['risks', 'recommendations', 'simulator', 'reports', 'compare', 'evidence-improvement'] },
  { label: 'System', ids: ['settings'] },
];

interface GlassRailProps {
  mobileOpen?: boolean;
  onNavigate?: () => void;
}

export default function GlassRail({ mobileOpen = false, onNavigate }: GlassRailProps) {
  const { railExpanded, toggleRailExpanded } = useTheme();

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-[#202124]/30 backdrop-blur-sm md:hidden"
          onClick={onNavigate}
          aria-hidden="true"
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col border-r border-[#E3E5E7] bg-[#F1F2F3] transition-[width,transform] duration-200 ease-out ${railExpanded ? 'w-60' : 'w-[68px]'
          } ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
      >
        {/* Brand Header */}
        <div
          className={`flex h-14 shrink-0 items-center border-b border-[#E3E5E7] ${railExpanded ? 'px-4 gap-3' : 'justify-center px-2'
            }`}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-500/20">
            <span className="font-mono text-xs font-bold tracking-wider text-white">
              RX
            </span>
          </div>
          {railExpanded && (
            <div className="min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-bold tracking-tight text-slate-900">
                  ReFrameX
                </span>
                <span className="rounded-full bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 font-mono text-[9px] font-bold text-indigo-700">
                  PRO
                </span>
              </div>
              <p className="truncate font-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                Migration Intelligence
              </p>
            </div>
          )}
        </div>

        {/* Navigation Groups */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-3" aria-label="Primary Navigation">
          {groups.map((group) => {
            const items = group.ids
              .map((id) => railItems.find((item) => item.id === id))
              .filter((item): item is (typeof railItems)[number] => Boolean(item));

            if (items.length === 0) return null;

            return (
              <div key={group.label} className="mb-4 last:mb-0">
                {railExpanded ? (
                  <p className="px-3 pb-1 pt-1 font-mono text-[10px] font-medium uppercase tracking-[0.08em] text-[#A0A4A8]">
                    {group.label}
                  </p>
                ) : (
                  <div className="mx-2 mb-2 border-t border-[#E3E5E7]" />
                )}
                <div className="space-y-1">
                  {items.map((item) => {
                    const Icon = icons[item.icon] ?? LayoutDashboard;
                    return (
                      <NavLink
                        key={item.id}
                        to={item.path}
                        end={item.path === '/'}
                        onClick={onNavigate}
                        title={!railExpanded ? item.label : undefined}
                        className={({ isActive }) =>
                          `group relative flex h-9 items-center rounded-xl transition-all duration-150 ${railExpanded ? 'px-3 gap-2.5' : 'justify-center px-0'
                          } ${isActive
                            ? 'bg-white text-indigo-950 font-bold shadow-2xs border border-indigo-100/80'
                            : 'text-slate-600 hover:bg-white/80 hover:text-slate-900'
                          }`
                        }
                      >
                        {({ isActive }) => (
                          <>
                            {isActive && (
                              <span className="absolute -left-1 top-2 bottom-2 w-[3px] rounded-r bg-indigo-600" />
                            )}
                            <Icon
                              size={16}
                              strokeWidth={isActive ? 2 : 1.75}
                              className={`shrink-0 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-500 group-hover:text-slate-900'
                                }`}
                            />
                            {railExpanded && (
                              <span className="truncate text-[13px] leading-tight">
                                {item.label}
                              </span>
                            )}
                          </>
                        )}
                      </NavLink>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>

        {/* Footer Collapse Toggle */}
        <div className="border-t border-[#E3E5E7] p-2.5">
          <button
            onClick={toggleRailExpanded}
            className={`hidden h-9 w-full items-center rounded-xl text-[#777D83] transition-colors hover:bg-white/70 hover:text-[#202124] md:flex ${railExpanded ? 'gap-2 px-3' : 'justify-center'
              }`}
            aria-label={railExpanded ? 'Collapse navigation' : 'Expand navigation'}
            title={railExpanded ? 'Collapse navigation' : 'Expand navigation'}
          >
            {railExpanded ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />}
            {railExpanded && <span className="text-xs font-medium">Collapse Navigation</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
