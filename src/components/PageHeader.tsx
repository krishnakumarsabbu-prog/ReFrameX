import { ChevronRight } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  breadcrumb?: string[];
  action?: React.ReactNode;
}

export default function PageHeader({ title, breadcrumb, action }: PageHeaderProps) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav
            className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[#777D83]"
            aria-label="Breadcrumb"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-600 shrink-0" />
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <ChevronRight size={11} className="text-slate-300" />}
                <span className={i === breadcrumb.length - 1 ? 'text-indigo-600 font-bold' : 'text-slate-500 font-medium'}>
                  {crumb}
                </span>
              </span>
            ))}
          </nav>
        )}
        <h1 className="font-sans text-2xl font-medium tracking-tight text-[#202124] md:text-3xl">
          {title}
        </h1>
      </div>
      {action && <div className="shrink-0 flex items-center gap-2.5 pt-1">{action}</div>}
    </div>
  );
}
