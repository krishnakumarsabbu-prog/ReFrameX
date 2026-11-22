import { type ReactNode } from 'react';

interface BentoCardProps {
  children: ReactNode;
  className?: string;
  dense?: boolean;
  onClick?: () => void;
  title?: string;
}

export default function BentoCard({
  children,
  className = '',
  dense = false,
  onClick,
  title,
}: BentoCardProps) {
  return (
    <div
      title={title}
      onClick={onClick}
      className={`rounded-2xl border border-slate-200/90 bg-white shadow-[0_4px_20px_rgba(30,41,59,0.04)] transition-all duration-200 ${dense ? 'p-4 sm:p-5' : 'p-6'
        } ${onClick
          ? 'cursor-pointer hover:border-indigo-300 hover:shadow-[0_8px_25px_rgba(30,41,59,0.08)]'
          : ''
        } ${className}`}
    >
      {children}
    </div>
  );
}
