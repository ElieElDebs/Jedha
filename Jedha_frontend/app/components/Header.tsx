import Link from 'next/link';

type Props = {
  onToggle?: () => void;
};

export default function Header({ onToggle }: Props) {
  return (
    <header className="sticky top-0 z-20 border-b bg-white/75 backdrop-blur-xl" style={{ borderColor: 'var(--stroke)' }}>
      <div className="container flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            className="mr-2 inline-flex items-center justify-center rounded-md p-2 lg:hidden transition"
            style={{ color: 'var(--foreground)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--surface-soft)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            aria-label="Open menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <nav className="hidden lg:flex items-center gap-2 sm:gap-3">
          <Link
            href="/audit"
            className="rounded-full px-3 py-1.5 text-sm font-medium transition"
            style={{ color: 'var(--foreground)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary-soft)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Audit
          </Link>
          <a
            href="#"
            className="rounded-full px-3 py-1.5 text-sm font-medium transition"
            style={{ color: 'var(--foreground)' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--primary-soft)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            Docs
          </a>
        </nav>
      </div>
    </header>
  );
}
