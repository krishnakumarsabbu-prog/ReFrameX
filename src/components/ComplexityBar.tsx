interface ComplexityBarProps {
  score: number; // 0 - 100
  showLabel?: boolean;
  className?: string;
}

export default function ComplexityBar({
  score,
  showLabel = true,
  className = '',
}: ComplexityBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));

  // Threshold rules: <50 Cool Slate (#777D83), 50–74 Restrained Amber (#D97706), >=75 Restrained Crimson (#DC2626)
  let barColor = 'bg-[#777D83]';
  let textColor = 'text-[#777D83]';

  if (clamped >= 75) {
    barColor = 'bg-[#DC2626]';
    textColor = 'text-[#DC2626]';
  } else if (clamped >= 50) {
    barColor = 'bg-[#D97706]';
    textColor = 'text-[#D97706]';
  }

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-[#E3E5E7]">
        <div
          className={`h-full rounded-full transition-all duration-300 ${barColor}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className={`font-mono text-xs font-medium tabular-nums ${textColor}`}>
          {clamped}<span className="text-[#A0A4A8] font-normal">/100</span>
        </span>
      )}
    </div>
  );
}
