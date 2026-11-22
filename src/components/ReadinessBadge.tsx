export interface ReadinessBadgeProps {
  status: string;
  size?: 'sm' | 'md';
  className?: string;
}

export default function ReadinessBadge({
  status,
  size = 'sm',
  className = '',
}: ReadinessBadgeProps) {
  const norm = (status || '').trim().toLowerCase();

  let style = 'bg-[#F0FDF4] text-[#166534] border-[#DCFCE7]';
  let dotColor = 'bg-[#16A34A]';
  let label = 'Ready for Planning';

  if (norm.includes('partial')) {
    style = 'bg-[#FEFCE8] text-[#92400E] border-[#FEF08A]';
    dotColor = 'bg-[#D97706]';
    label = 'Partially Ready';
  } else if (norm.includes('not ready') || norm.includes('blocked') || norm.includes('unsupported') || norm.includes('failed')) {
    style = 'bg-[#FEF2F2] text-[#991B1B] border-[#FECACA]';
    dotColor = 'bg-[#DC2626]';
    label = 'Not Ready';
  } else if (norm.includes('ready')) {
    style = 'bg-[#F0FDF4] text-[#166534] border-[#DCFCE7]';
    dotColor = 'bg-[#16A34A]';
    label = 'Ready for Planning';
  } else {
    label = status;
    style = 'bg-[#F1F2F3] text-[#777D83] border-[#E3E5E7]';
    dotColor = 'bg-[#777D83]';
  }

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-lg border border-solid font-medium leading-none whitespace-nowrap transition-colors ${style} ${sizeClasses} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
      <span>{label}</span>
    </span>
  );
}
