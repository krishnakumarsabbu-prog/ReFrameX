import { type ReactNode } from 'react';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-[#E3E5E7] bg-white p-12 text-center shadow-[0_4px_16px_rgba(25,30,35,0.04)]">
      <div className="mb-3.5 h-8 w-8 animate-spin rounded-full border-2 border-[#E3E5E7] border-t-[#202124]" />
      <span className="text-xs font-medium text-[#777D83]">{label}</span>
    </div>
  );
}

export function ErrorState({ message = 'Something went wrong.' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-[#FECACA] bg-[#FEF2F2]/60 p-8 text-center">
      <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-[#FEF2F2] border border-[#FECACA] text-sm font-bold text-[#DC2626]">
        !
      </div>
      <span className="text-xs font-medium text-[#991B1B]">{message}</span>
    </div>
  );
}

interface DataTableProps {
  columns: { key: string; label: string; width?: string; align?: 'left' | 'right' | 'center' }[];
  rows: Record<string, ReactNode>[];
  className?: string;
}

export function DataTable({ columns, rows, className = '' }: DataTableProps) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-[#E3E5E7] bg-white shadow-[0_4px_16px_rgba(25,30,35,0.04)] ${className}`}>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[#E3E5E7] bg-[#F1F2F3]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`px-5 py-3.5 text-[11px] font-medium uppercase tracking-[0.06em] text-[#777D83] ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    }`}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E3E5E7]">
            {rows.map((row, i) => (
              <tr
                key={i}
                className="transition-colors hover:bg-[#F1F2F3]/50 h-12"
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-5 py-3 text-xs text-[#202124] ${col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                      }`}
                  >
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="py-8 text-center text-xs text-[#777D83]">
                  No records to display.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ChartContainerProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  badge?: string;
  className?: string;
  action?: ReactNode;
}

export function ChartContainer({
  title,
  subtitle,
  children,
  badge,
  className = '',
  action,
}: ChartContainerProps) {
  return (
    <div className={`rounded-2xl border border-[#E3E5E7] bg-white p-6 shadow-[0_4px_16px_rgba(25,30,35,0.04)] ${className}`}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-sans text-[15px] font-medium tracking-tight text-[#202124]">
              {title}
            </h3>
            {badge && (
              <span className="rounded-lg bg-[#F1F2F3] px-2 py-0.5 font-mono text-[10px] font-medium text-[#777D83]">
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="mt-1 text-xs text-[#777D83]">{subtitle}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}
