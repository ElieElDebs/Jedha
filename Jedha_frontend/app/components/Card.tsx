import React from 'react';

type Props = {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
};

export default function Card({ title, subtitle, children }: Props) {
  return (
    <div className="material-card p-5 sm:p-6">
      {(title || subtitle) && (
        <div className="mb-4">
          {title && <div className="text-base font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>{title}</div>}
          {subtitle && <div className="mt-1 text-xs font-medium uppercase tracking-[0.12em]" style={{ color: 'var(--primary-strong)' }}>{subtitle}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
