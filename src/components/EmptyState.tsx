import { type ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  summary: string;
  phase?: string;
  bullets?: string[];
  action?: ReactNode;
}

export default function EmptyState({ icon, title, summary, phase, bullets, action }: EmptyStateProps) {
  return (
    <div className="glass rounded-bento p-10 md:p-14 flex flex-col items-center text-center max-w-2xl mx-auto">
      {icon && (
        <div className="w-16 h-16 rounded-2xl bg-accent-soft flex items-center justify-center mb-5 text-accent">
          {icon}
        </div>
      )}
      {phase && (
        <span className="inline-flex items-center px-3 py-1 rounded-pill text-xs font-medium bg-accent-soft text-accent mb-4">
          Coming in {phase}
        </span>
      )}
      <h2 className="text-2xl font-semibold text-ink mb-3">{title}</h2>
      <p className="text-ink-muted leading-relaxed max-w-lg mb-6">{summary}</p>
      {bullets && bullets.length > 0 && (
        <ul className="text-left w-full max-w-md space-y-2 mb-6">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-ink-muted">
              <span className="w-1.5 h-1.5 rounded-full bg-accent mt-2 shrink-0" />
              {b}
            </li>
          ))}
        </ul>
      )}
      {action}
    </div>
  );
}
