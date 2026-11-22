import type { EvidenceClass } from '@/types';

export interface EvidenceBadgeProps {
  evidence?: EvidenceClass | string;
  size?: 'sm' | 'md';
  className?: string;
  showDot?: boolean;
}

export default function EvidenceBadge({
  evidence = 'Evidence-based',
  size = 'sm',
  className = '',
  showDot = true,
}: EvidenceBadgeProps) {
  const norm = (evidence || '').trim().toLowerCase();

  let style = 'bg-[#F0FDF4] text-[#166534] border-[#DCFCE7]';
  let dotColor = 'bg-[#16A34A]';
  let label = 'Evidence-Based';
  let isDashed = false;

  if (norm.includes('inferred')) {
    style = 'bg-[#F3F4F6] text-[#374151] border-[#E5E7EB]';
    dotColor = 'bg-[#6B7280]';
    label = 'Inferred';
  } else if (norm.includes('assumed')) {
    style = 'bg-[#FEFCE8] text-[#92400E] border-[#FEF08A]';
    dotColor = 'bg-[#D97706]';
    label = 'Assumed';
  } else if (norm.includes('unknown') || norm.includes('gap')) {
    style = 'bg-[#F5F3FF] text-[#5B21B6] border-[#DDD6FE]';
    dotColor = 'bg-[#7C3AED]';
    label = 'Unknown / Gap';
    isDashed = true;
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg font-medium leading-none whitespace-nowrap transition-colors ${isDashed ? 'border border-dashed' : 'border border-solid'
        } ${style} ${sizeClasses} ${className}`}
      title={label}
    >
      {showDot && (
        <span
          className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor} ${isDashed ? 'opacity-80' : ''}`}
        />
      )}
      <span className="truncate">{label}</span>
    </span>
  );
}
