import { type ReactNode } from 'react';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="glass rounded-bento p-10 flex flex-col items-center justify-center text-center">
      <div className="w-10 h-10 border-3 border-accent/30 border-t-accent rounded-full animate-spin mb-4" style={{ borderWidth: '3px' }} />
      <span className="text-sm text-ink-muted">{label}</span>
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong.' }: { message?: string }) {
  return (
    <div className="glass rounded-bento p-10 flex flex-col items-center justify-center text-center">
      <div className="w-12 h-12 rounded-2xl bg-severity-high/15 flex items-center justify-center mb-4 text-severity-high text-xl font-bold">!</div>
      <span className="text-sm text-ink-muted">{message}</span>
    </div>
  );
}

interface DataTableProps {
  columns: { key: string; label: string; width?: string }[];
  rows: Record<string, ReactNode>[];
}

export function DataTable({ columns, rows }: DataTableProps) {
  return (
    <div className="dense-surface rounded-bento overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-solid-border">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="text-left px-4 py-3 text-xs font-medium text-ink-soft uppercase tracking-wide"
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-solid-border last:border-0 hover:bg-black/[0.02] transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className="px-4 py-3 text-ink">
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ChartContainerProps {
  title: string;
  children: ReactNode;
  badge?: string;
  className?: string;
}

export function ChartContainer({ title, children, badge, className = '' }: ChartContainerProps) {
  return (
    <div className={`glass rounded-bento p-5 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {badge && (
          <span className="inline-flex items-center px-2 py-0.5 rounded-pill text-[10px] font-medium bg-ink/8 text-ink-muted">
            {badge}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
