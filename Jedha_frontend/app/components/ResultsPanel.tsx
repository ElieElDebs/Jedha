import React, { useState } from 'react';
import type { AuditReport } from '../../lib/types';

type Props = { report?: AuditReport };

/**
 * Display raw results returned by the audit backend.
 */
export default function ResultsPanel({ report }: Props) {
  if (!report) {
    return <div className="rounded-[22px] border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-8 text-sm text-slate-500">No report yet.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-emerald-50 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
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
    <div className="rounded-[22px] border border-emerald-100 bg-[var(--panel-alt)] p-4">
      <div className="mb-2 flex items-start justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800/80">{provider}</div>
          <div className="mt-2 text-sm font-medium text-slate-800">Résumé</div>
          <div className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">{llmText ?? <span className="text-slate-400">No LLM summary available.</span>}</div>
        </div>
        <div className="ml-4 flex shrink-0 flex-col items-end gap-2">
          <div className="text-xs text-slate-600">Queries: <strong className="text-slate-800">{(queries?.length ?? 0)}</strong></div>
          <div className="text-xs text-slate-600">Competitors: <strong className="text-slate-800">{(competitors?.length ?? 0)}</strong></div>
          <div className="text-xs text-slate-600">Sources: <strong className="text-slate-800">{(sources?.metadata?.number_of_used_sources ?? sources?.number_of_used_sources ?? 0)}</strong></div>
        </div>
      </div>

      {queries && queries.length > 0 && (
        <div className="mt-3">
          <div className="text-sm font-medium text-slate-800">Queries Variations</div>
          <ul className="mt-2 list-disc pl-5 text-sm text-slate-700">
            {queries.map((q: string, i: number) => (
              <li key={i}>{q}</li>
            ))}
          </ul>
        </div>
      )}

      {competitors && competitors.length > 0 && (
        <div className="mt-3">
          <div className="text-sm font-medium text-slate-800">Top Competitors</div>
          <ul className="mt-2 grid gap-1 text-sm text-slate-700">
            {competitors.slice(0, 5).map((c: any, i: number) => (
              <li key={i} className="flex items-center justify-between">
                <span>{c.name ?? c.title ?? JSON.stringify(c)}</span>
                <span className="text-xs text-slate-500">#{c.positionning ?? c.position ?? i}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {sources && (
        <div className="mt-3">
          <div className="text-sm font-medium text-slate-800">Sources</div>
          <div className="mt-1 text-sm text-slate-700">Used: {(sources?.metadata?.number_of_used_sources ?? sources?.number_of_used_sources ?? 0)}</div>
          {sources?.metadata?.used_sources && (
            <details className="mt-2 text-sm text-slate-700">
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
        <button onClick={() => setOpenRaw((v) => !v)} className="text-sm text-emerald-700 underline">
          {openRaw ? 'Cacher JSON' : 'Voir JSON brut'}
        </button>
        {raw?.error && <div className="text-sm font-medium text-red-600">Error: {raw.error}</div>}
      </div>

      {openRaw && (
        <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-white/50 p-3 text-sm text-slate-700">{JSON.stringify(raw?.metadata?.raw ?? raw, null, 2)}</pre>
      )}
    </div>
  );
}
