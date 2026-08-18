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
    return <div className="rounded-[22px] border border-dashed px-4 py-8 text-sm" style={{ borderColor: 'var(--primary-soft)', backgroundColor: 'var(--primary-soft)', color: 'var(--text-secondary)' }}>No comparison available yet.</div>;
  }

  return (
    <div className="flex flex-col gap-6">
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
  // Fallbacks: result.response may contain the 'data' object or be the data itself.
  // Additionally, the proxy stores the raw backend JSON in metadata.raw — use it as a final fallback.
  const data = parsed?.data ?? parsed ?? result?.metadata?.raw?.data ?? result?.metadata?.raw ?? null;
  const llmText = data?.llm_output?.text ?? data?.llm_output_text ?? '';
  const competitors = data?.competitors ?? [];
  const sources = data?.sources ?? null;

  return (
    <div className="rounded-[22px] border p-6 sm:p-8" style={{ borderColor: 'var(--stroke)', backgroundColor: 'white', boxShadow: 'var(--shadow-card)' }}>
      <div className="mb-6 flex items-start justify-between gap-6">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--primary-strong)' }}>{result.provider}</div>
          <div className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>Prompt: <span style={{ color: 'var(--foreground)' }}>{result.prompt ?? '-'}</span></div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {result.error ? (
            <div className="rounded-full px-2 py-1 text-xs font-medium" style={{ backgroundColor: '#fce4e4', color: '#d46a6a' }}>Error</div>
          ) : (
            <div className="rounded-full px-2 py-1 text-xs font-medium" style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary-strong)' }}>Live</div>
          )}
          <button onClick={() => setOpenRaw((v) => !v)} className="text-xs underline" style={{ color: 'var(--primary)' }}>{openRaw ? 'Cacher JSON' : 'Voir JSON'}</button>
        </div>
      </div>

      <div className="mb-3 text-base font-semibold" style={{ color: 'var(--foreground)' }}>Résumé</div>
      <div className="prose prose-sm max-w-none mt-2 text-base leading-7" style={{ color: 'var(--foreground)' }}>
        {llmText ? (
          <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(mdParse(llmText)) }} />
        ) : (
          <span style={{ color: 'var(--text-secondary)' }}>No summary</span>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between text-sm border-t" style={{ color: 'var(--text-secondary)', borderColor: 'var(--stroke)', paddingTop: '1.5rem' }}>
        <div>Competitors: <strong style={{ color: 'var(--foreground)' }}>{competitors.length}</strong></div>
        <div>Sources: <strong style={{ color: 'var(--foreground)' }}>{sources?.metadata?.number_of_used_sources ?? sources?.number_of_used_sources ?? 0}</strong></div>
      </div>

      {competitors && competitors.length > 0 && (
        <div className="mt-6 text-sm" style={{ color: 'var(--foreground)' }}>
          <div className="font-semibold text-base">Top competitors</div>
          <ul className="mt-3 list-inside list-disc space-y-2">
            {competitors.slice(0, 5).map((c: any, i: number) => (
              <li key={i}>{c.name ?? c.title ?? JSON.stringify(c)}</li>
            ))}
          </ul>
        </div>
      )}

      {sources && (
        <div className="mt-6 text-sm" style={{ color: 'var(--foreground)' }}>
          <div className="font-semibold text-base">Sources</div>
          <details className="mt-3 text-sm">
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
        <pre className="mt-6 max-h-96 overflow-auto whitespace-pre-wrap rounded-md p-4 text-xs border" style={{ backgroundColor: 'var(--panel-alt)', color: 'var(--foreground)', borderColor: 'var(--stroke)' }}>{JSON.stringify(result?.metadata?.raw ?? result, null, 2)}</pre>
      )}
    </div>
  );
}
