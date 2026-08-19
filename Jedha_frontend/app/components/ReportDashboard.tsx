"use client";
import { useState } from 'react';
import { parse as mdParse } from 'marked';
import DOMPurify from 'dompurify';

type Props = {
  provider: string;
  llmText?: string;
  queries: string[];
  competitors: any[];
  sources: any;
  assets: any[];
  assetDetected: boolean;
  raw?: any;
  error?: string;
};

export default function ReportDashboard({
  provider,
  llmText,
  queries,
  competitors,
  sources,
  assets,
  assetDetected,
  raw,
  error,
}: Props) {
  const [expandedLLM, setExpandedLLM] = useState(false);
  const [expandedSources, setExpandedSources] = useState(false);
  const [expandedAssets, setExpandedAssets] = useState(assetDetected);

  // Extract first 3 lines of LLM text
  const llmLines = llmText?.split('\n') ?? [];
  const llmPreview = llmLines.slice(0, 3).join('\n');
  const hasMoreLLM = llmLines.length > 3;

  // Calculate KPIs
  const totalSources = sources?.metadata?.number_of_sources ?? 0;
  const usedSources = sources?.metadata?.number_of_used_sources ?? 0;
  const sourceUtilization = totalSources > 0 ? Math.round((usedSources / totalSources) * 100) : 0;

  const allDomains = sources?.metadata?.all_domains ?? [];
  const topDomains = allDomains.slice(0, 3);

  const avgCompetitorRank = competitors.length > 0
    ? (competitors.reduce((sum: number, c: any) => sum + (c.positionning ?? 0), 0) / competitors.length).toFixed(1)
    : 0;

  const usedSourcesList = sources?.metadata?.used_sources ?? [];
  const allSourcesList = sources?.metadata?.all_sources ?? [];
  const unusedSources = allSourcesList.filter(
    (url: string) => !usedSourcesList.some((s: any) => (typeof s === 'string' ? s : s.url) === url)
  );

  return (
    <div className="space-y-4 rounded-[22px] border p-6" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel-alt)' }}>
      {/* Header with Provider */}
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: 'var(--stroke)' }}>
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ color: 'var(--primary-strong)' }}>
            {provider.toUpperCase()}
          </div>
          <div className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            {queries.length > 0 && `Query: ${queries[0]}`}
          </div>
        </div>
        {error && (
          <div className="rounded-full px-3 py-1 text-sm font-medium" style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
            Error
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* KPIs Row */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPICard label="Competitors Found" value={competitors.length} />
        <KPICard label="Avg Rank" value={avgCompetitorRank} />
        <KPICard label="Sources Used" value={usedSources} subvalue={`/${totalSources}`} />
        <KPICard label="Source Utilization" value={`${sourceUtilization}%`} />
      </div>

      {/* LLM Output Section */}
      {llmText && (
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>LLM Analysis</h3>
            <button
              onClick={() => setExpandedLLM(!expandedLLM)}
              className="text-xs font-medium underline"
              style={{ color: 'var(--primary)' }}
            >
              {expandedLLM ? 'Show less' : 'Show more'}
            </button>
          </div>
          <div
            className={`prose prose-sm max-w-none text-sm leading-6 ${!expandedLLM ? 'line-clamp-3' : ''}`}
            style={{ color: 'var(--foreground)' }}
          >
            {expandedLLM ? (
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(mdParse(llmText)) }} />
            ) : (
              <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(mdParse(llmPreview)) }} />
            )}
          </div>
          {!expandedLLM && hasMoreLLM && (
            <div className="mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              +{llmLines.length - 3} more lines
            </div>
          )}
        </div>
      )}

      {/* Assets Detection Section */}
      <div className="rounded-lg border p-4" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Assets Detection</h3>
            <div
              className="rounded-full px-2 py-1 text-xs font-bold"
              style={{
                backgroundColor: assetDetected ? '#ecfdf5' : '#fef3f2',
                color: assetDetected ? '#059669' : '#dc2626'
              }}
            >
              {assetDetected ? '✓ Detected' : '○ Not Detected'}
            </div>
          </div>
          {assets && assets.length > 0 && (
            <button
              onClick={() => setExpandedAssets(!expandedAssets)}
              className="text-xs font-medium underline"
              style={{ color: 'var(--primary)' }}
            >
              {expandedAssets ? 'Hide' : 'Show'}
            </button>
          )}
        </div>

        {assetDetected && assets && assets.length > 0 ? (
          expandedAssets && (
            <div className="space-y-2">
              {assets
                .filter((asset: any) => asset.count > 0)
                .map((asset: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 rounded-lg px-3 py-2 border" style={{ borderColor: 'var(--stroke)', backgroundColor: assetDetected ? '#ecfdf5' : 'var(--primary-soft)' }}>
                    <div
                      className="flex items-center justify-center rounded-full w-8 h-8 text-xs font-bold text-white"
                      style={{ backgroundColor: assetDetected ? '#059669' : 'var(--primary)' }}
                    >
                      {asset.count}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                        {asset.asset}
                      </div>
                      {asset.positions && asset.positions.length > 0 && (
                        <div className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                          Positions: {asset.positions.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )
        ) : (
          <div className="rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--text-secondary)' }}>
            No assets were detected in the response
          </div>
        )}
      </div>

      {/* Competitors Section */}
      {competitors.length > 0 && (
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}>
          <h3 className="mb-3 font-semibold" style={{ color: 'var(--foreground)' }}>Competitors Ranking</h3>
          <div className="space-y-2">
            {competitors.map((c: any, idx: number) => (
              <div key={idx} className="flex items-center gap-3 rounded-lg px-3 py-2 border" style={{ borderColor: 'var(--stroke)' }}>
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                  style={{
                    backgroundColor: getPodiumColor(c.positionning),
                    color: 'white',
                  }}
                >
                  #{c.positionning ?? idx}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {c.name ?? c.title ?? 'Unknown'}
                  </div>
                </div>
                <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  Position {c.positionning ?? idx}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sources Section */}
      {(usedSourcesList.length > 0 || allSourcesList.length > 0) && (
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>Sources</h3>
            <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {usedSources} / {totalSources}
            </div>
          </div>

          {/* Used Sources */}
          {usedSourcesList.length > 0 && (
            <div className="mb-4">
              <div className="mb-2 text-xs font-semibold uppercase" style={{ color: 'var(--primary-strong)' }}>
                Used Sources ({usedSourcesList.length})
              </div>
              <div className="space-y-1">
                {usedSourcesList.map((source: any, idx: number) => {
                  const url = typeof source === 'string' ? source : source.url;
                  const title = typeof source === 'object' ? source.title : null;
                  return (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:opacity-80"
                      style={{ backgroundColor: '#ecfdf5', color: 'var(--foreground)' }}
                    >
                      <span className="mt-0.5 text-green-600">✓</span>
                      <div className="flex-1 break-all">
                        <div className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                          {title || new URL(url).hostname}
                        </div>
                        <div className="text-xs opacity-60">{url}</div>
                      </div>
                      <span className="shrink-0 text-lg">↗</span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Unused Sources */}
          {unusedSources.length > 0 && (
            <div>
              <button
                onClick={() => setExpandedSources(!expandedSources)}
                className="mb-2 text-xs font-semibold uppercase underline"
                style={{ color: 'var(--text-secondary)' }}
              >
                {expandedSources ? 'Hide' : 'Show'} Unused Sources ({unusedSources.length})
              </button>
              {expandedSources && (
                <div className="space-y-1">
                  {unusedSources.map((url: string, idx: number) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm transition hover:opacity-80"
                      style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--foreground)' }}
                    >
                      <span className="mt-0.5" style={{ color: 'var(--text-secondary)' }}>○</span>
                      <div className="flex-1 break-all">
                        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {new URL(url).hostname}
                        </div>
                        <div className="text-xs opacity-60">{url}</div>
                      </div>
                      <span className="shrink-0 text-lg">↗</span>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Top Domains KPI */}
      {topDomains.length > 0 && (
        <div className="rounded-lg border p-4" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}>
          <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>Top Domains</h3>
          <div className="space-y-2">
            {topDomains.map(([domain, count]: any, idx: number) => (
              <div key={idx} className="flex items-center gap-2">
                <div className="flex-1 text-xs" style={{ color: 'var(--foreground)' }}>
                  {domain}
                </div>
                <div className="flex h-6 items-center rounded-full px-2 text-xs font-bold" style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary-strong)' }}>
                  {count}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KPICard({ label, value, subvalue }: { label: string; value: any; subvalue?: string }) {
  return (
    <div className="rounded-lg border p-3" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}>
      <div className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
        {label}
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <div className="text-2xl font-bold" style={{ color: 'var(--primary)' }}>
          {value}
        </div>
        {subvalue && (
          <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            {subvalue}
          </div>
        )}
      </div>
    </div>
  );
}

function getPodiumColor(position: number): string {
  switch (position) {
    case 0:
      return '#fbbf24'; // gold
    case 1:
      return '#9ca3af'; // silver
    case 2:
      return '#d97706'; // bronze
    default:
      return '#6b7280'; // gray
  }
}
