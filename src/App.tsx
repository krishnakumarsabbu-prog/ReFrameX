import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/hooks/useTheme';
import { useActiveTab } from '@/hooks/useActiveTab';
import AppLayout from '@/layouts/AppLayout';

const Dashboard = lazy(() => import('@/pages/Dashboard'));
const ApplicationsPage = lazy(() => import('@/pages/ApplicationsPage'));
const ArtifactsPage = lazy(() => import('@/pages/ArtifactsPage'));
const IntelligencePage = lazy(() => import('@/pages/IntelligencePage'));
const DependenciesPage = lazy(() => import('@/pages/DependenciesPage'));
const PlaceholderPage = lazy(() => import('@/pages/PlaceholderPage'));
const AssessmentPage = lazy(() => import('@/pages/AssessmentPage'));
const EvidenceExplorerPage = lazy(() => import('@/pages/EvidenceExplorerPage'));
const UnknownsAndRisksPage = lazy(() => import('@/pages/UnknownsAndRisksPage'));
const RecommendationsPage = lazy(() => import('@/pages/RecommendationsPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
const ComparePage = lazy(() => import('@/pages/ComparePage'));
const EvidenceImprovementPage = lazy(() => import('@/pages/EvidenceImprovementPage'));
const SimulatorPage = lazy(() => import('@/pages/SimulatorPage'));

export default function App() {
  const { activeTab, setActiveTab } = useActiveTab();

  return (
    <ThemeProvider>
      <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
        <Suspense fallback={<div role="status" className="flex min-h-[40vh] items-center justify-center text-sm text-ink-muted">Loading module…</div>}>
          <Routes>
            <Route path="/" element={<Dashboard activeTab={activeTab} />} />
            <Route path="/applications" element={<ApplicationsPage />} />
            <Route path="/artifacts" element={<ArtifactsPage />} />
            <Route path="/intelligence" element={<IntelligencePage />} />
            <Route path="/dependencies" element={<DependenciesPage />} />
            <Route path="/complexity" element={<AssessmentPage />} />
            <Route path="/evidence" element={<EvidenceExplorerPage />} />
            <Route path="/risks" element={<UnknownsAndRisksPage />} />
            <Route path="/recommendations" element={<RecommendationsPage />} />
            <Route path="/simulator" element={<SimulatorPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/compare" element={<ComparePage />} />
            <Route path="/evidence-improvement" element={<EvidenceImprovementPage />} />
            <Route path="/settings" element={<PlaceholderPage moduleId="settings" />} />
          </Routes>
        </Suspense>
      </AppLayout>
    </ThemeProvider>
  );
}
