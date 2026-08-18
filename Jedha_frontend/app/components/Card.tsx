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
          {title && <div className="text-base font-semibold tracking-tight text-slate-900">{title}</div>}
          {subtitle && <div className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-emerald-700/80">{subtitle}</div>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}
