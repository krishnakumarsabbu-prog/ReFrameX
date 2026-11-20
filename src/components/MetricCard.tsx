import { type ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'flat';
  hint?: string;
  icon?: ReactNode;
}

export default function MetricCard({ label, value, unit, trend, trendDirection, hint, icon }: MetricCardProps) {
  const trendColor =
    trendDirection === 'up' ? 'text-severity-low' :
    trendDirection === 'down' ? 'text-severity-high' :
    'text-ink-soft';

  return (
    <div className="glass rounded-bento p-5 transition-all duration-200 hover:shadow-float hover:-translate-y-0.5 h-full">
      <div className="flex items-start justify-between mb-3">
        <span className="text-xs font-medium text-ink-muted tracking-wide uppercase">{label}</span>
        {icon && <span className="text-ink-soft">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-semibold text-ink tracking-tight">{value}</span>
        {unit && <span className="text-sm font-medium text-ink-soft">{unit}</span>}
      </div>
      <div className="flex items-center gap-2 mt-2">
        {trend && (
          <span className={`text-xs font-medium ${trendColor}`}>
            {trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '→'} {trend}
          </span>
        )}
        {hint && <span className="text-xs text-ink-soft">{hint}</span>}
      </div>
    </div>
  );
}
