interface ConfidenceBarProps {
  percentage: number; // 0 - 100
  showLabel?: boolean;
  className?: string;
}

export default function ConfidenceBar({
  percentage,
  showLabel = true,
  className = '',
}: ConfidenceBarProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percentage)));

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="relative h-1.5 w-16 overflow-hidden rounded-full bg-[#E3E5E7]">
        <div
          className="h-full rounded-full bg-[#202124] transition-all duration-300"
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="font-mono text-xs font-medium text-[#202124] tabular-nums">
          {clamped}%
        </span>
      )}
    </div>
  );
}
