import React, { useState } from 'react';
import type { AuditReport } from '../../lib/types';

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
  const [openRaw, setOpenRaw] = useState(false);

  return (
    <div className="rounded-[22px] border p-4" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel-alt)' }}>
      <div className="mb-2 flex items-start justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: 'var(--primary-strong)' }}>{provider}</div>
          <div className="mt-2 text-sm font-medium" style={{ color: 'var(--foreground)' }}>Résumé</div>
          <div className="mt-1 whitespace-pre-wrap text-sm leading-6" style={{ color: 'var(--foreground)' }}>{llmText ?? <span style={{ color: 'var(--text-secondary)' }}>No LLM summary available.</span>}</div>
        </div>
        <div className="ml-4 flex shrink-0 flex-col items-end gap-2">
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Queries: <strong style={{ color: 'var(--foreground)' }}>{(queries?.length ?? 0)}</strong></div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Competitors: <strong style={{ color: 'var(--foreground)' }}>{(competitors?.length ?? 0)}</strong></div>
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>Sources: <strong style={{ color: 'var(--foreground)' }}>{(sources?.metadata?.number_of_used_sources ?? sources?.number_of_used_sources ?? 0)}</strong></div>
        </div>
      </div>

      {queries && queries.length > 0 && (
        <div className="mt-3">
          <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Queries Variations</div>
          <ul className="mt-2 list-disc pl-5 text-sm" style={{ color: 'var(--foreground)' }}>
            {queries.map((q: string, i: number) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {competitors && competitors.length > 0 && (
        <div className="mt-3">
          <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Top Competitors</div>
          <ul className="mt-2 grid gap-1 text-sm" style={{ color: 'var(--foreground)' }}>
            {competitors.slice(0, 5).map((c: any, i: number) => (
              <li key={i} className="flex items-center justify-between">
                <span>{c.name ?? c.title ?? JSON.stringify(c)}</span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>#{c.positionning ?? c.position ?? i}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sources && (
        <div className="mt-3">
          <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>Sources</div>
          <div className="mt-1 text-sm" style={{ color: 'var(--foreground)' }}>Used: {(sources?.metadata?.number_of_used_sources ?? sources?.number_of_used_sources ?? 0)}</div>
          {sources?.metadata?.used_sources && (
            <details className="mt-2 text-sm" style={{ color: 'var(--foreground)' }}>
              <summary className="cursor-pointer">Voir les sources utilisées</summary>
              <ul className="mt-2 pl-4 list-disc">
                {sources.metadata.used_sources.map((s: any, i: number) => (
                  <li key={i} className="break-words">
                    {typeof s === 'string' ? s : s.url ?? JSON.stringify(s)}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between">
        <button onClick={() => setOpenRaw((v) => !v)} className="text-sm underline" style={{ color: 'var(--primary)' }}>
          {openRaw ? 'Cacher JSON' : 'Voir JSON brut'}
        </button>
        {raw?.error && <div className="text-sm font-medium" style={{ color: '#d46a6a' }}>Error: {raw.error}</div>}
      </div>

      {openRaw && (
        <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-md p-3 text-sm" style={{ backgroundColor: 'var(--panel-alt)', color: 'var(--foreground)' }}>{JSON.stringify(raw?.metadata?.raw ?? raw, null, 2)}</pre>
      )}
    </div>
  );
}
