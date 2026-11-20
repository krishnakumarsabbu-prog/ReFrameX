import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@/hooks/useTheme';
import { useActiveTab } from '@/hooks/useActiveTab';
import AppLayout from '@/layouts/AppLayout';
import Dashboard from '@/pages/Dashboard';
import PlaceholderPage from '@/pages/PlaceholderPage';

export default function App() {
  const { activeTab, setActiveTab } = useActiveTab();

  return (
    <ThemeProvider>
      <AppLayout activeTab={activeTab} onTabChange={setActiveTab}>
        <Routes>
          <Route path="/" element={<Dashboard activeTab={activeTab} />} />
          <Route path="/applications" element={<PlaceholderPage moduleId="applications" />} />
          <Route path="/artifacts" element={<PlaceholderPage moduleId="artifacts" />} />
          <Route path="/intelligence" element={<PlaceholderPage moduleId="intelligence" />} />
          <Route path="/dependencies" element={<PlaceholderPage moduleId="dependencies" />} />
          <Route path="/complexity" element={<PlaceholderPage moduleId="complexity" />} />
          <Route path="/evidence" element={<PlaceholderPage moduleId="evidence" />} />
          <Route path="/risks" element={<PlaceholderPage moduleId="risks" />} />
          <Route path="/recommendations" element={<PlaceholderPage moduleId="recommendations" />} />
          <Route path="/simulator" element={<PlaceholderPage moduleId="simulator" />} />
          <Route path="/reports" element={<PlaceholderPage moduleId="reports" />} />
          <Route path="/compare" element={<PlaceholderPage moduleId="compare" />} />
          <Route path="/settings" element={<PlaceholderPage moduleId="settings" />} />
        </Routes>
      </AppLayout>
    </ThemeProvider>
  );
}
