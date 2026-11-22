interface RingProgressProps {
  value: number; // 0-100
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  color?: string;
  trackColor?: string;
}

export default function RingProgress({
  value,
  size = 112,
  stroke = 7,
  label,
  sublabel,
  color = '#202124',
  trackColor = '#E3E5E7',
}: RingProgressProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  const offset = circumference - (clamped / 100) * circumference;

  return (
    <div className="flex flex-col items-center" style={{ width: size }}>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={trackColor}
            strokeWidth={stroke}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-normal text-[#202124] tabular-nums leading-none">
            {clamped}%
          </span>
          {sublabel && (
            <span className="mt-1 font-mono text-[9px] uppercase tracking-wider text-[#777D83]">
              {sublabel}
            </span>
          )}
        </div>
      </div>
      {label && (
        <span className="mt-2 text-center text-xs font-medium text-[#777D83]">
          {label}
        </span>
      )}
    </div>
  );
}
