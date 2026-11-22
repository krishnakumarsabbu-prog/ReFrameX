import { type ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  trend?: string;
  trendDirection?: 'up' | 'down' | 'flat';
  hint?: string;
  icon?: ReactNode;
  featured?: boolean;
}

export default function MetricCard({
  label,
  value,
  unit,
  trend,
  trendDirection,
  hint,
  icon,
  featured = false,
}: MetricCardProps) {
  const trendColor =
    trendDirection === 'up'
      ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
      : trendDirection === 'down'
        ? 'text-rose-700 bg-rose-50 border-rose-200'
        : 'text-slate-600 bg-slate-50 border-slate-200';

  return (
    <div
      className={`flex h-full flex-col justify-between rounded-2xl border p-6 transition-all duration-200 ${featured
          ? 'border-indigo-500/80 bg-gradient-to-b from-indigo-50/20 to-white shadow-[0_8px_24px_rgba(30,41,59,0.06)] ring-1 ring-indigo-500/20'
          : 'border-slate-200/90 bg-white shadow-[0_4px_16px_rgba(30,41,59,0.04)] hover:border-indigo-200 hover:shadow-[0_8px_24px_rgba(30,41,59,0.06)]'
        }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          {featured && (
            <span className="h-2 w-2 rounded-full bg-indigo-500 ring-2 ring-indigo-400/40 shrink-0" />
          )}
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
            {label}
          </span>
        </div>
        {icon && (
          <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-indigo-100 bg-indigo-50 text-indigo-700">
            {icon}
          </span>
        )}
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-3xl sm:text-4xl font-bold leading-tight tracking-tight text-slate-900 tabular-nums">
            {value}
          </span>
          {unit && (
            <span className="font-mono text-sm font-semibold text-slate-400">
              {unit}
            </span>
          )}
        </div>
        <div className="mt-3 flex items-center gap-2">
          {trend && (
            <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-xs font-semibold tabular-nums ${trendColor}`}>
              {trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '→'} {trend}
            </span>
          )}
          {hint && (
            <span className="text-xs text-slate-500">
              {hint}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
