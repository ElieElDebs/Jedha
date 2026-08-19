import type { AuditReport } from '../../lib/types';
import ReportDashboard from './ReportDashboard';

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
  let parsed: any = null;
  try {
    parsed = typeof result.response === 'string' ? JSON.parse(result.response) : result.response;
  } catch (e) {
    parsed = null;
  }

  const data = parsed?.data ?? parsed ?? result?.metadata?.raw?.data ?? result?.metadata?.raw ?? null;
  const llmText = data?.llm_output?.text ?? data?.llm_output_text ?? '';
  const competitors = data?.competitors ?? [];
  const sources = data?.sources ?? null;
  const kpi = data?.kpi ?? {};
  const assets = kpi?.assets_and_competitors_sorted ?? [];
  const assetDetected = kpi?.asset_detected ?? false;
  const queries = data?.queries ?? [];

  return (
    <ReportDashboard
      provider={result.provider}
      llmText={llmText}
      queries={queries}
      competitors={competitors}
      sources={sources}
      assets={assets}
      assetDetected={assetDetected}
      raw={result?.metadata?.raw ?? result}
      error={result?.error}
    />
  );
}
