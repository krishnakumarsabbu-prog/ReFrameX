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
    <div className="fixed bottom-5 left-1/2 z-30 -translate-x-1/2">
      <div className="flex items-center gap-1.5 rounded-full border border-[#E3E5E7] bg-white/95 backdrop-blur-md px-2.5 py-1.5 shadow-[0_8px_24px_rgba(25,30,35,0.08)]">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-medium tracking-wide transition-all duration-150 ${isActive
                  ? 'bg-[#202124] text-white shadow-sm'
                  : 'text-[#777D83] hover:bg-[#F1F2F3] hover:text-[#202124]'
                }`}
            >
              {tab.label}
            </button>
          );
        })}
        {showAddAction && (
          <>
            <div className="mx-1 h-5 w-px bg-[#E3E5E7]" />
            <button
              onClick={onAddAction ?? (() => navigate('/applications'))}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#202124] text-white transition-colors hover:bg-[#333538] hover:text-[#C5F45A] shadow-sm"
              aria-label={addActionLabel ?? 'Add'}
              title={addActionLabel ?? 'Add'}
            >
              <Plus size={15} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
