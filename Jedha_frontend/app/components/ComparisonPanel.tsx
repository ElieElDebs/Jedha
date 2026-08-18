import React from 'react';
import type { AuditReport } from '../../lib/types';
import { parse as mdParse } from 'marked';
import DOMPurify from 'dompurify';

type Props = { report?: AuditReport };

/**
 * Simple side-by-side comparison view for providers.
 */
export default function ComparisonPanel({ report }: Props) {
  if (!report) {
    return <div className="rounded-[22px] border border-dashed border-emerald-200 bg-emerald-50/60 px-4 py-8 text-sm text-slate-500">No comparison available yet.</div>;
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {report.results.map((r) => (
        <ComparisonCard key={r.provider} result={r} />
      ))}
    </div>
  );
}

function ComparisonCard({ result }: any) {
  const [openRaw, setOpenRaw] = React.useState(false);

  let parsed: any = null;
  try {
    parsed = typeof result.response === 'string' ? JSON.parse(result.response) : result.response;
  } catch (e) {
    parsed = null;
  }
  const data = parsed?.data ?? parsed ?? null;
  const llmText = data?.llm_output?.text ?? data?.llm_output_text ?? '';
  const competitors = data?.competitors ?? [];
  const sources = data?.sources ?? null;

  return (
    <div className="rounded-[22px] border border-emerald-100 bg-white p-4 shadow-[0_8px_20px_rgba(47,125,94,0.08)]">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-800/80">{result.provider}</div>
          <div className="mt-2 text-xs text-slate-500">Prompt: <span className="text-slate-700">{result.prompt ?? '-'}</span></div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {result.error ? (
            <div className="rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700">Error</div>
          ) : (
            <div className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">Live</div>
          )}
          <button onClick={() => setOpenRaw((v) => !v)} className="text-xs text-emerald-700 underline">{openRaw ? 'Cacher JSON' : 'Voir JSON'}</button>
        </div>
      </div>

      <div className="mb-2 text-sm font-medium text-slate-800">Résumé</div>
      <div className="prose max-w-none mt-1 text-sm leading-6 text-slate-700">
        {llmText ? (
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(mdParse(llmText)) }} />
        ) : (
          <span className="text-slate-400">No summary</span>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
        <div>Competitors: <strong className="text-slate-800">{competitors.length}</strong></div>
        <div>Sources: <strong className="text-slate-800">{sources?.metadata?.number_of_used_sources ?? sources?.number_of_used_sources ?? 0}</strong></div>
      </div>

      {competitors && competitors.length > 0 && (
        <div className="mt-3 text-sm text-slate-700">
          <div className="font-medium text-slate-800">Top competitors</div>
          <ul className="mt-2 list-inside list-disc">
            {competitors.slice(0, 5).map((c: any, i: number) => (
              <li key={i}>{c.name ?? c.title ?? JSON.stringify(c)}</li>
            ))}
          </ul>
        </div>
      )}

      {sources && (
        <div className="mt-3 text-sm text-slate-700">
          <div className="font-medium text-slate-800">Sources</div>
          <details className="mt-2 text-sm text-slate-700">
            <summary className="cursor-pointer">Voir les sources utilisées ({sources?.metadata?.number_of_used_sources ?? sources?.number_of_used_sources ?? 0})</summary>
            <ul className="mt-2 pl-4 list-disc">
              {(sources?.metadata?.used_sources ?? sources?.used_sources ?? []).map((s: any, i: number) => (
                <li key={i} className="break-words">{typeof s === 'string' ? s : s.url ?? JSON.stringify(s)}</li>
              ))}
            </ul>
          </details>
        </div>
      )}

      {openRaw && (
        <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-white/50 p-3 text-sm text-slate-700">{JSON.stringify(result?.metadata?.raw ?? result, null, 2)}</pre>
      )}
    </div>
  );
}
