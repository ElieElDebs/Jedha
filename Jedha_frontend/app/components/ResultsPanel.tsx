import { useState } from 'react';
import type { AuditReport } from '../../lib/types';
import ReportDashboard from './ReportDashboard';

type Props = { report?: AuditReport };

/**
 * Display raw results returned by the audit backend.
 */
export default function ResultsPanel({ report }: Props) {
  if (!report) {
    return <div className="rounded-[22px] border border-dashed px-4 py-8 text-sm" style={{ borderColor: 'var(--primary-soft)', backgroundColor: 'var(--primary-soft)', color: 'var(--text-secondary)' }}>No report yet.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary-strong)' }}>
        Report ID: {report.id}
      </div>

      <div className="grid gap-4">
        {report.results.map((r) => {
          // r.response may be a stringified JSON or simple text
          let parsed: any = null;
          try {
            parsed = typeof r.response === 'string' ? JSON.parse(r.response) : r.response;
          } catch (e) {
            parsed = null;
          }

          const data = parsed?.data ?? parsed ?? null;
          const llmText = data?.llm_output?.text ?? data?.llm_output_text ?? null;
          const queries = data?.queries ?? [];
          const competitors = data?.competitors ?? [];
          const sources = data?.sources ?? null;

          return (
            <ResultCard
              key={r.provider}
              provider={r.provider}
              raw={r}
              llmText={llmText}
              queries={queries}
              competitors={competitors}
              sources={sources}
            />
          );
        })}
      </div>
    </div>
  );
}

function ResultCard({ provider, raw, llmText, queries, competitors, sources }: any) {
  const [showRaw, setShowRaw] = useState(false);

  const kpiData = sources?.metadata ?? sources ?? {};
  const assets = kpiData?.assets_and_competitors_sorted ?? [];
  const assetDetected = kpiData?.asset_detected ?? false;

  return (
    <>
      <ReportDashboard
        provider={provider}
        llmText={llmText}
        queries={queries}
        competitors={competitors || []}
        sources={sources}
        assets={assets}
        assetDetected={assetDetected}
        raw={raw}
        error={raw?.error}
      />

      {/* Raw JSON Toggle */}
      <div className="mt-4 flex justify-center">
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="text-sm font-medium underline"
          style={{ color: 'var(--primary)' }}
        >
          {showRaw ? 'Hide' : 'Show'} Raw JSON
        </button>
      </div>

      {showRaw && (
        <pre
          className="mt-4 max-h-96 overflow-auto rounded-lg border p-4 text-xs"
          style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)', color: 'var(--foreground)' }}
        >
          {JSON.stringify(raw?.metadata?.raw ?? raw, null, 2)}
        </pre>
      )}
    </>
  );
}
