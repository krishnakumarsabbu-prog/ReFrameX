import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  summary: string;
  phase?: string;
  bullets?: string[];
  action?: ReactNode;
}

export default function EmptyState({
  icon,
  title,
  summary,
  phase,
  bullets,
  action,
}: EmptyStateProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center rounded-2xl border border-[#E3E5E7] bg-white p-8 text-center shadow-[0_4px_16px_rgba(25,30,35,0.04)] md:p-12">
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-[#E3E5E7] bg-[#F1F2F3] text-[#202124]">
          {icon}
        </div>
      )}
      {phase && (
        <span className="mb-3 inline-flex items-center rounded-lg border border-[#E3E5E7] bg-[#F1F2F3] px-2.5 py-0.5 font-mono text-[11px] font-medium text-[#202124]">
          Phase: {phase}
        </span>
      )}
      <h2 className="mb-2 text-xl font-medium tracking-tight text-[#202124]">{title}</h2>
      <p className="mb-6 max-w-md text-xs leading-relaxed text-[#777D83]">{summary}</p>
      {bullets && bullets.length > 0 && (
        <ul className="mb-6 w-full max-w-sm space-y-2 text-left">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-2.5 text-xs text-[#777D83]">
              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C5F45A] ring-2 ring-[#C5F45A]/30" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      )}
      {action}
    </div>
  );
}
