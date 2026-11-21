import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/hooks/useTheme';
import { useActiveTab } from '@/hooks/useActiveTab';
import AppLayout from '@/layouts/AppLayout';
import Dashboard from '@/pages/Dashboard';
import ApplicationsPage from '@/pages/ApplicationsPage';
import ArtifactsPage from '@/pages/ArtifactsPage';
import IntelligencePage from '@/pages/IntelligencePage';
import DependenciesPage from '@/pages/DependenciesPage';
import PlaceholderPage from '@/pages/PlaceholderPage';
import AssessmentPage from '@/pages/AssessmentPage';
import EvidenceExplorerPage from '@/pages/EvidenceExplorerPage';
import UnknownsAndRisksPage from '@/pages/UnknownsAndRisksPage';
import RecommendationsPage from '@/pages/RecommendationsPage';
import ReportsPage from '@/pages/ReportsPage';
import ComparePage from '@/pages/ComparePage';
import EvidenceImprovementPage from '@/pages/EvidenceImprovementPage';
import SimulatorPage from '@/pages/SimulatorPage';

export default function App() {
  const { activeTab, setActiveTab } = useActiveTab();

  return (
    <ThemeProvider>
      <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
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
      </AppLayout>
    </ThemeProvider>
  );
}
