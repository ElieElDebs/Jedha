"use client";
import { useState } from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import QueryEditor from '../components/QueryEditor';
import ResultsPanel from '../components/ResultsPanel';
import ComparisonPanel from '../components/ComparisonPanel';
import type { AuditPayload, AuditResponse } from '../../lib/types';
import { postAudit } from '../../lib/api';

export default function AuditApp() {
  const [report, setReport] = useState<AuditResponse | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  async function handleSubmit(payload: AuditPayload) {
    setLoading(true);
    try {
      const res = await postAudit(payload);
      setReport(res);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <Header onToggle={() => setSidebarOpen((v) => !v)} />
      <div className="container flex flex-col gap-6 px-0 py-6 lg:flex-row lg:items-start lg:py-8">
        <Sidebar mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="flex-1 lg:ml-[280px]">
          <div className="space-y-6">
            <section className="material-card overflow-hidden p-0">
              <div className="p-5 sm:p-6" style={{ backgroundColor: 'var(--primary-soft)' }}>
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--primary-strong)' }}>Audit</p>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>Run an Audit</h1>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl text-lg shadow-sm" style={{ backgroundColor: 'var(--primary)', color: 'white' }}>
                    🌿
                  </div>
                </div>

                <p className="mb-5 max-w-2xl text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>
                  Compare AI providers with a structured, sustainability-minded audit workflow.
                </p>

                <QueryEditor onSubmit={handleSubmit} />

                {loading && (
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium" style={{ borderColor: 'var(--primary)', backgroundColor: 'var(--primary-soft)', color: 'var(--primary-strong)' }}>
                    <span className="h-2 w-2 animate-pulse rounded-full" style={{ backgroundColor: 'var(--primary)' }} />
                    Running audit…
                  </div>
                )}
              </div>
            </section>

            <div className="grid gap-6">
              <section className="material-card p-5 sm:p-6">
                <h2 className="mb-4 text-lg font-semibold text-slate-900">Comparison</h2>
                <ComparisonPanel report={report?.report} />
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
