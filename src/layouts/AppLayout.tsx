import { type ReactNode, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTheme } from '@/hooks/useTheme';
import GlassRail from '@/components/GlassRail';
import TopPillBar from '@/components/TopPillBar';
import BottomTabBar from '@/components/BottomTabBar';
import ReFrameXChatBot from '@/components/chat/ReFrameXChatBot';
import { railItems } from '@/mock-data';

interface AppLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function AppLayout({ children, activeTab, onTabChange }: AppLayoutProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { railExpanded } = useTheme();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const currentModule = railItems.find(
    (item) => item.path === location.pathname || (item.path !== '/' && location.pathname.startsWith(item.path))
  );

  const tabs = currentModule?.tabs ?? (currentModule?.id === 'dashboard' ? dashboardTabs() : undefined);
  const showAddAction = currentModule?.id === 'applications';
  const addActionLabel = showAddAction ? 'New application' : undefined;
  const onAddAction = showAddAction ? () => navigate('/applications') : undefined;

  return (
    <div className="min-h-screen bg-[#F1F3F7] text-[#202124]">
      <GlassRail mobileOpen={mobileNavOpen} onNavigate={() => setMobileNavOpen(false)} />

      <div
        className={`flex min-h-screen min-w-0 flex-col transition-[margin] duration-200 ease-out ${railExpanded ? 'md:ml-60' : 'md:ml-[68px]'
          }`}
      >
        <TopPillBar onOpenMobileNav={() => setMobileNavOpen(true)} />

        <main className="flex-1 px-4 pb-24 pt-6 sm:px-8 sm:pt-8 lg:px-10">
          <div className="mx-auto w-full max-w-[1520px]">{children}</div>
        </main>
      </div>

      {tabs && tabs.length > 0 && (
        <BottomTabBar
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          showAddAction={showAddAction}
          addActionLabel={addActionLabel}
          onAddAction={onAddAction}
        />
      )}

      {/* Global AI Copilot with per-page context isolation */}
      <ReFrameXChatBot />
    </div>
  );
}

function dashboardTabs() {
  return [
    { id: 'overview', label: 'Overview' },
    { id: 'risks', label: 'Risks' },
    { id: 'actions', label: 'Actions' },
  ];
}
