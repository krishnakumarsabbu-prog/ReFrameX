import { type ReactNode } from 'react';
import type { Severity, EvidenceClass } from '@/types';
import EvidenceBadge from './EvidenceBadge';
import ReadinessBadge from './ReadinessBadge';

const badgeBase =
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-medium leading-none border transition-colors';

const severityStyles: Record<Severity, { className: string; dot: string; label: string }> = {
  high: {
    className: 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]',
    dot: 'bg-[#DC2626]',
    label: 'High',
  },
  medium: {
    className: 'bg-[#FEFCE8] text-[#92400E] border-[#FEF08A]',
    dot: 'bg-[#D97706]',
    label: 'Medium',
  },
  low: {
    className: 'bg-[#F0FDF4] text-[#166534] border-[#DCFCE7]',
    dot: 'bg-[#16A34A]',
    label: 'Low',
  },
  info: {
    className: 'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]',
    dot: 'bg-[#6B7280]',
    label: 'Info',
  },
};

function statusConfig(status: string): { className: string; dot: string } {
  const normalized = status.trim().toLowerCase();

  if (
    [
      'complete',
      'completed',
      'assessed',
      'active',
      'parsed',
      'success',
      'succeeded',
      'supported',
      'full extract',
      'full_extract',
    ].includes(normalized)
  ) {
    return {
      className: 'bg-[#F0FDF4] text-[#166534] border-[#DCFCE7]',
      dot: 'bg-[#16A34A]',
    };
  }

  if (
    [
      'in progress',
      'in_progress',
      'pending',
      'running',
      'partial',
      'partial extract',
      'partial_extract',
    ].includes(normalized)
  ) {
    return {
      className: 'bg-[#F3F4F6] text-[#202124] border-[#E5E7EB]',
      dot: 'bg-[#202124]',
    };
  }

  if (
    [
      'failed',
      'error',
      'on hold',
      'blocked',
      'unsupported',
      'missing',
    ].includes(normalized)
  ) {
    return {
      className: 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]',
      dot: 'bg-[#DC2626]',
    };
  }

  if (['not started', 'not assessed', 'queued', 'detect only', 'detect_only'].includes(normalized)) {
    return {
      className: 'bg-[#FEFCE8] text-[#92400E] border-[#FEF08A]',
      dot: 'bg-[#D97706]',
    };
  }

  return {
    className: 'bg-[#F1F2F3] text-[#777D83] border-[#E3E5E7]',
    dot: 'bg-[#777D83]',
  };
}

interface StatusBadgeProps {
  status?: string;
  severity?: Severity;
  evidence?: EvidenceClass | string;
  readiness?: string;
  children?: ReactNode;
  size?: 'sm' | 'md';
  className?: string;
}

export default function StatusBadge({
  status,
  severity,
  evidence,
  readiness,
  children,
  size = 'sm',
  className = '',
}: StatusBadgeProps) {
  if (readiness) {
    return <ReadinessBadge status={readiness} size={size} className={className} />;
  }

  if (evidence) {
    return <EvidenceBadge evidence={evidence} size={size} className={className} />;
  }

  if (severity) {
    const config = severityStyles[severity] ?? severityStyles.info;
    const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';
    return (
      <span className={`${badgeBase} ${config.className} ${sizeClasses} ${className}`}>
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${config.dot}`} />
        <span>{config.label}</span>
      </span>
    );
  }

  const resolvedStatus = status || (typeof children === 'string' ? children : 'Unknown');
  const config = statusConfig(resolvedStatus);
  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span className={`${badgeBase} ${config.className} ${sizeClasses} ${className}`}>
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${config.dot}`} />
      <span className="capitalize">{resolvedStatus.replace(/_/g, ' ')}</span>
    </span>
  );
}
