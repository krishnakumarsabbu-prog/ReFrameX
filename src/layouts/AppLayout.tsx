import { type ReactNode, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import GlassRail from '@/components/GlassRail';
import TopPillBar from '@/components/TopPillBar';
import BottomTabBar from '@/components/BottomTabBar';
import { railItems } from '@/mock-data';

interface AppLayoutProps {
  children: ReactNode;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export default function AppLayout({ children, activeTab, onTabChange }: AppLayoutProps) {
  const location = useLocation();

  const currentModule = useMemo(() => railItems.find(
    (item) => item.path === location.pathname || (item.path !== '/' && location.pathname.startsWith(item.path))
  ), [location.pathname]);

  const tabs = currentModule?.tabs ?? (currentModule?.id === 'dashboard' ? dashboardTabs() : undefined);
  const showAddAction = currentModule?.id === 'applications';

  return (
    <>
      <div className="app-bg" aria-hidden="true">
        <span className="app-blob app-blob--bronze" />
        <span className="app-blob app-blob--sand" />
        <span className="app-blob app-blob--amber" />
        <span className="app-blob app-blob--teal" />
        <span className="app-blob app-blob--brown" />
        <span className="app-blob app-blob--light" />
      </div>
      <TopPillBar />
      <GlassRail />

      <main className="min-h-screen pt-24 pb-24 px-3 sm:px-4 md:px-6 transition-all duration-200" style={{ paddingLeft: 'clamp(5rem, 8vw, 7rem)' }}>
        <div className="workspace-shell rounded-[var(--workspace-radius)] max-w-[1480px] mx-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          {children}
        </div>
      </main>

      {tabs && tabs.length > 0 && (
        <BottomTabBar
          tabs={tabs}
          activeTab={activeTab}
          onTabChange={onTabChange}
          showAddAction={showAddAction}
          addActionLabel={showAddAction ? 'New application' : undefined}
        />
      )}
    </>
  );
}

function dashboardTabs() {
  return [
    { id: 'overview', label: 'Overview' },
    { id: 'risks', label: 'Risks' },
    { id: 'actions', label: 'Actions' },
  ];
}
