import { type ReactNode, useState, useMemo } from 'react';
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

  const currentModule = useMemo(() => {
    return railItems.find(
      (item) => item.path === location.pathname || (item.path !== '/' && location.pathname.startsWith(item.path))
    );
  }, [location.pathname]);

  const tabs = currentModule?.tabs ?? (currentModule?.id === 'dashboard' ? dashboardTabs() : undefined);
  const showAddAction = currentModule?.id === 'applications';

  return (
    <>
      <div className="app-bg" />
      <TopPillBar />
      <GlassRail />

      <main
        className="min-h-screen pt-24 pb-24 px-4 transition-all duration-200"
        style={{ paddingLeft: 'calc(5rem + 0.5rem)', paddingRight: '1rem' }}
      >
        <div className="max-w-7xl mx-auto">{children}</div>
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
