import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';

interface TabDef {
  id: string;
  label: string;
}

interface BottomTabBarProps {
  tabs: TabDef[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  showAddAction?: boolean;
  addActionLabel?: string;
  onAddAction?: () => void;
}

export default function BottomTabBar({
  tabs,
  activeTab,
  onTabChange,
  showAddAction = false,
  addActionLabel,
  onAddAction,
}: BottomTabBarProps) {
  const navigate = useNavigate();

  if (!tabs || tabs.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40">
      <div className="glass-strong rounded-pill flex items-center gap-1 px-2 py-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`px-4 py-2 rounded-2xl text-sm font-medium transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-white text-ink shadow-sm'
                : 'text-ink-muted hover:text-ink hover:bg-white/20'
            }`}
          >
            {tab.label}
          </button>
        ))}
        {showAddAction && (
          <>
            <div className="w-px h-6 bg-white/30 mx-1" />
            <button
              onClick={onAddAction ?? (() => navigate('/applications'))}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-white text-ink hover:bg-white/85 transition-colors shadow-sm"
              aria-label={addActionLabel ?? 'Add'}
              title={addActionLabel ?? 'Add'}
            >
              <Plus size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
