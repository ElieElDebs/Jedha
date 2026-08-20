import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const items = [
  { label: 'Dashboard', href: '/audit' },
  { label: 'Reports', href: '/reports' },
  { label: 'Settings', href: '/settings' },
];

type Props = {
  mobileOpen?: boolean;
  onClose?: () => void;
};

export default function Sidebar({ mobileOpen, onClose }: Props) {
  const pathname = usePathname();

  const isActive = (href: string) => pathname.startsWith(href);

  const SidebarContent = () => (
    <>
      <div className="mb-5 flex items-center gap-3 rounded-2xl p-3" style={{ backgroundColor: 'var(--primary-soft)' }}>
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: 'var(--primary)' }}>
          J
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Jedha</div>
          <div className="text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--text-secondary)' }}>Audit suite</div>
        </div>
      </div>

      <nav className="space-y-2">
        {items.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onClose}
              className="flex w-full items-center justify-between rounded-r-2xl px-3 py-2.5 text-left text-sm font-medium transition"
              style={active ? {
                backgroundColor: 'var(--primary-soft)',
                color: 'var(--primary-strong)'
              } : {
                color: 'var(--foreground)'
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'var(--surface-soft)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'transparent';
                }
              }}
            >
              <span>{item.icon} {item.label}</span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>›</span>
            </Link>
          );
        })}
      </nav>
    </>
  );

  return (
    <>
      {/* Desktop / large screens */}
      <aside className="hidden lg:block material-card h-screen w-full p-4 lg:fixed lg:top-0 lg:left-0 lg:w-[280px] lg:shrink-0 lg:z-30">
        <SidebarContent />
      </aside>

      {/* Mobile slide-over */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/30" onClick={onClose} />
          <aside className="relative z-50 w-72 p-4" style={{ backgroundColor: 'white' }}>
            <div className="mb-5 flex items-center justify-between">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold text-white shadow-sm" style={{ backgroundColor: 'var(--primary)' }}>J</div>
              <button onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
                ✕
              </button>
            </div>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  );
}
