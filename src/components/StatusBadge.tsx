import type { Severity, EvidenceClass } from '@/types';

const severityStyles: Record<Severity, { bg: string; text: string; label: string }> = {
  high: { bg: 'bg-severity-high/15', text: 'text-severity-high', label: 'High' },
  medium: { bg: 'bg-severity-medium/15', text: 'text-severity-medium', label: 'Medium' },
  low: { bg: 'bg-severity-low/15', text: 'text-severity-low', label: 'Low' },
  info: { bg: 'bg-severity-info/15', text: 'text-severity-info', label: 'Info' },
};

const evidenceStyles: Record<EvidenceClass, { bg: string; text: string }> = {
  'Evidence-based': { bg: 'bg-severity-low/15', text: 'text-severity-low' },
  'Inferred': { bg: 'bg-severity-medium/15', text: 'text-severity-medium' },
  'Assumed': { bg: 'bg-evidence-assumed/15', text: 'text-evidence-assumed' },
  'Unknown': { bg: 'bg-evidence-unknown/15', text: 'text-evidence-unknown' },
};

interface StatusBadgeProps {
  severity?: Severity;
  evidence?: EvidenceClass;
  status?: string;
  children?: React.ReactNode;
}

export default function StatusBadge({ severity, evidence, status, children }: StatusBadgeProps) {
  if (severity) {
    const s = severityStyles[severity];
    return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-medium ${s.bg} ${s.text}`}>{s.label}</span>;
  }
  if (evidence) {
    const s = evidenceStyles[evidence];
    return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-medium ${s.bg} ${s.text}`}>{evidence}</span>;
  }
  if (status) {
    const color =
      status === 'Complete' ? 'bg-severity-low/15 text-severity-low' :
      status === 'In Progress' ? 'bg-severity-medium/15 text-severity-medium' :
      'bg-evidence-unknown/15 text-evidence-unknown';
    return <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-medium ${color}`}>{status}</span>;
  }
  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-pill text-xs font-medium bg-ink/8 text-ink-muted">{children}</span>;
}
