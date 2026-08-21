"use client";
import { useState } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import ReportsPanel from '../components/ReportsPanel';

export default function ReportsPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="app-shell">
      <Header onToggle={() => setSidebarOpen((v) => !v)} />
      <div className="container flex flex-col gap-6 px-0 py-6 lg:flex-row lg:items-start lg:py-8">
        <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-w-0 flex-1 lg:ml-[280px]">
          <div className="space-y-6">
            <section className="material-card overflow-hidden p-0">
              <div className="p-5 sm:p-6" style={{ backgroundColor: 'var(--primary-soft)' }}>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--primary-strong)' }}>Reports</p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>Batch Reports</h1>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-lg shadow-sm" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
                    📊
                  </div>
                </div>

                <p className="mb-5 max-w-2xl text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  Upload an Excel file with your queries and assets to generate batch reports for multiple providers.
                </p>
              </div>
            </section>

            <ReportsPanel />
          </div>
        </main>
      </div>
    </div>
  );
}
