import { useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import EmptyState from '@/components/EmptyState';
import { moduleDescriptions } from '@/mock-data';

interface PlaceholderPageProps {
  moduleId: string;
}

export default function PlaceholderPage({ moduleId }: PlaceholderPageProps) {
  const navigate = useNavigate();
  const info = moduleDescriptions[moduleId];
  if (!info) return null;

  const iconName = moduleId === 'applications' ? 'Boxes' :
    moduleId === 'artifacts' ? 'FileSearch' :
    moduleId === 'intelligence' ? 'Sparkles' :
    moduleId === 'dependencies' ? 'GitBranch' :
    moduleId === 'complexity' ? 'Gauge' :
    moduleId === 'evidence' ? 'ScrollText' :
    moduleId === 'risks' ? 'AlertTriangle' :
    moduleId === 'recommendations' ? 'Lightbulb' :
    moduleId === 'simulator' ? 'FlaskConical' :
    moduleId === 'reports' ? 'FileText' :
    moduleId === 'compare' ? 'Columns3' :
    moduleId === 'settings' ? 'Settings' : 'Circle';

  const Icon = (Icons as unknown as Record<string, Icons.LucideIcon>)[iconName] ?? Icons.Circle;

  return (
    <>
      <PageHeader title={info.title} breadcrumb={['ReframeX', info.title]} />
      <EmptyState
        icon={<Icon size={28} />}
        title={info.title}
        summary={info.summary}
        phase={info.phase}
        bullets={info.bullets}
        action={
          <button
            onClick={() => navigate('/')}
            className="px-5 py-2.5 rounded-pill bg-ink text-white text-sm font-medium hover:bg-ink/90 transition-colors"
          >
            Back to Dashboard
          </button>
        }
      />
    </>
  );
}
