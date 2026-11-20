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
  size = 120,
  stroke = 10,
  label,
  sublabel,
  color = 'rgb(var(--accent-rgb))',
  trackColor = 'rgba(255,255,255,0.5)',
}: RingProgressProps) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(100, value));
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
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold text-ink">{clamped}</span>
          {sublabel && <span className="text-[10px] text-ink-soft mt-0.5">{sublabel}</span>}
        </div>
      </div>
      {label && <span className="text-xs font-medium text-ink-muted text-center mt-2 leading-tight">{label}</span>}
    </div>
  );
}
