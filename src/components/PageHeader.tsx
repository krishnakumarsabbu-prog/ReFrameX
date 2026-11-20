interface PageHeaderProps {
  title: string;
  breadcrumb?: string[];
  action?: React.ReactNode;
}

export default function PageHeader({ title, breadcrumb, action }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        {breadcrumb && breadcrumb.length > 0 && (
          <nav className="flex items-center gap-1.5 text-xs text-ink-soft mb-2">
            {breadcrumb.map((crumb, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-ink-soft/50">/</span>}
                <span className={i === breadcrumb.length - 1 ? 'text-ink-muted font-medium' : ''}>{crumb}</span>
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-2xl md:text-3xl font-semibold text-ink tracking-tight">{title}</h1>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
