import { type ReactNode } from 'react';

interface BentoCardProps {
  children: ReactNode;
  className?: string;
  dense?: boolean;
  onClick?: () => void;
}

export default function BentoCard({ children, className = '', dense = false, onClick }: BentoCardProps) {
  const base = dense ? 'dense-surface' : 'glass';
  return (
    <div
      onClick={onClick}
      className={`${base} rounded-bento transition-all duration-200 ${onClick ? 'cursor-pointer hover:shadow-float hover:-translate-y-0.5' : ''} ${className}`}
    >
      {children}
    </div>
  );
}
