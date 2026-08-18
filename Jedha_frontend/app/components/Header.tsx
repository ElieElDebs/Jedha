import Link from 'next/link';

type Props = {
  onToggle?: () => void;
};

export default function Header({ onToggle }: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-emerald-100 bg-white/75 backdrop-blur-xl">
      <div className="container flex items-center justify-between py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggle}
            className="mr-2 inline-flex items-center justify-center rounded-md p-2 text-slate-700 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>

          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#2f7d5e_0%,#65b995_100%)] text-sm font-semibold text-white shadow-[0_8px_18px_rgba(47,125,94,0.25)]">
              A
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight text-slate-900">AuditGeo</div>
            </div>
          </Link>
        </div>

        <nav className="hidden lg:flex items-center gap-2 sm:gap-3">
          <Link
            href="/audit"
            className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-900"
          >
            Audit
          </Link>
          <a
            href="#"
            className="rounded-full px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-emerald-50 hover:text-emerald-900"
          >
            Docs
          </a>
        </nav>
      </div>
    </header>
  );
}
