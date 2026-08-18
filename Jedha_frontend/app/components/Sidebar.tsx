import React from 'react';

const items = [
  { label: 'Overview', tone: 'emerald', active: true },
  { label: 'Providers', tone: 'amber', active: false },
  { label: 'Settings', tone: 'slate', active: false },
];

const toneStyles: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-900 ring-1 ring-amber-100',
  sand: 'bg-stone-100 text-stone-800 ring-1 ring-stone-200',
  clay: 'bg-rose-50 text-rose-900 ring-1 ring-rose-100',
  slate: 'bg-slate-100 text-slate-800 ring-1 ring-slate-200',
};

type Props = {
  mobileOpen?: boolean;
  onClose?: () => void;
};

export default function Sidebar({ mobileOpen, onClose }: Props) {
  return (
    <>
      {/* Desktop / large screens */}
      <aside className="hidden lg:block material-card h-screen w-full p-4 lg:fixed lg:top-0 lg:left-0 lg:w-[280px] lg:shrink-0 lg:z-30">
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-[linear-gradient(135deg,rgba(47,125,94,0.10),rgba(201,169,139,0.14))] p-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2f7d5e_0%,#7bbd9c_100%)] text-sm font-semibold text-white shadow-sm">
          J
        </div>
        <div>
          <div className="text-sm font-semibold text-slate-900">Jedha</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Audit suite</div>
        </div>
      </div>

      <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Navigation</div>

      <nav className="space-y-2">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`flex w-full items-center justify-between rounded-r-2xl px-3 py-2.5 text-left text-sm font-medium transition ${
              item.active ? toneStyles[item.tone] : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-900'
            }`}
          >
            <span>{item.label}</span>
            <span className="text-xs text-slate-400">›</span>
          </button>
        ))}
      </nav>

      <div className="mt-6 rounded-[22px] bg-[linear-gradient(135deg,#f6efe7,#fdfaf6)] p-4 ring-1 ring-[#e8d8c7]">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8a6846]">Impact</div>
        <div className="mt-2 text-2xl font-semibold text-slate-900">82%</div>
        <div className="mt-1 text-xs text-slate-600">Sustainability score</div>
      </div>
      </aside>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/30" onClick={onClose} />
          <aside className="relative z-50 w-72 bg-white p-4">
            <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl bg-[linear-gradient(135deg,rgba(47,125,94,0.10),rgba(201,169,139,0.14))] p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2f7d5e_0%,#7bbd9c_100%)] text-sm font-semibold text-white shadow-sm">J</div>
              <button onClick={onClose} className="text-slate-600">
                Close
              </button>
            </div>

            <nav className="space-y-2">
              {items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className={`flex w-full items-center justify-between rounded-r-2xl px-3 py-2.5 text-left text-sm font-medium transition ${
                    item.active ? toneStyles[item.tone] : 'text-slate-700 hover:bg-emerald-50 hover:text-emerald-900'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-xs text-slate-400">›</span>
                </button>
              ))}
            </nav>
          </aside>
        </div>
      )}
    </>
  );
}
