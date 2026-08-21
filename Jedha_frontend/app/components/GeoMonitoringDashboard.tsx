"use client";
import { useMemo, useState } from 'react';
import { parse as mdParse } from 'marked';
import DOMPurify from 'dompurify';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getPaginationRowModel,
  getFilteredRowModel,
  SortingState,
  getSortedRowModel,
} from '@tanstack/react-table';

interface AuditResult {
  query: string;
  assets: string;
  status: 'pending' | 'success' | 'error';
  geminiResponse?: any;
  openaiResponse?: any;
  error?: string;
}

interface SourceRef {
  title: string;
  url: string;
}

interface RankedAsset {
  asset: string;
  count: number;
  positions: number[] | null;
  first: number | null;
}

interface ParsedResponse {
  competitors?: Array<{ name: string; positionning: number }>;
  queries?: string[];
  sources?: {
    metadata?: {
      number_of_sources?: number;
      number_of_used_sources?: number;
      all_sources?: string[];
      used_sources?: SourceRef[];
      used_source_with_markdown?: Array<[string, string | null]>;
    };
    kpi?: {
      used_domains?: Array<[string, number]>;
      asset_detected?: boolean;
      assets_and_competitors_sorted?: RankedAsset[];
      grounding_cosine_similarities?: Array<{ text: string; cosine_similarity: number }>;
    };
  };
  llm_output?: { text?: string };
  [key: string]: any;
}

interface DashboardData {
  query: string;
  engine: string;
  assetDetected: boolean;
  assetPosition?: number;
  competitors: Array<{ name: string; positionning: number }>;
  totalSources: number;
  usedSources: number;
  topDomains: Array<[string, number]>;
  grounding?: number;
  llmText?: string;
  searchQueries: string[];
  allSourceUrls: string[];
  usedSourcesList: SourceRef[];
  rankedAssets: RankedAsset[];
  targetAsset: string;
  scrapedSources: Array<{ url: string; markdown: string }>;
  groundingSegments: Array<{ text: string; cosine_similarity: number }>;
}

type Props = {
  results: AuditResult[];
};

const getDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

// French + English stopwords, stripped of accents to match normalized tokens.
const QUERY_STOPWORDS = new Set([
  'le', 'la', 'les', 'un', 'une', 'des', 'du', 'de', 'et', 'ou', 'a', 'en', 'dans', 'pour',
  'sur', 'avec', 'par', 'est', 'qui', 'que', 'qu', 'ce', 'cet', 'cette', 'ces', 'au', 'aux',
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'son', 'sa', 'ses', 'notre', 'nos', 'votre', 'vos',
  'leur', 'leurs', 'se', 'plus', 'moins', 'tres', 'ne', 'pas', 'il', 'elle', 'ils', 'elles',
  'on', 'nous', 'vous', 'je', 'tu', 'quel', 'quelle', 'quels', 'quelles', 'ou', 'comment',
  'pourquoi', 'quand', 'the', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'is', 'are',
  'with', 'by', 'what', 'how', 'where', 'when', 'which', 'who',
]);

const tokenizeQuery = (query: string): string[] =>
  query
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !QUERY_STOPWORDS.has(word));

const parseJsonResponse = (response: any): ParsedResponse => {
  if (typeof response === 'string') {
    try {
      return JSON.parse(response);
    } catch {
      return {};
    }
  }
  return response || {};
};

const buildDashboardEntry = (result: AuditResult, engine: 'gemini' | 'openai', response: any): DashboardData => {
  const parsed = parseJsonResponse(response);
  const competitors = parsed.competitors || [];
  const assetsSorted = parsed.sources?.kpi?.assets_and_competitors_sorted || [];
  const assetIndex = assetsSorted.findIndex((a) => a.asset?.toLowerCase() === result.assets.toLowerCase());
  const groundingScores = parsed.sources?.kpi?.grounding_cosine_similarities || [];

  return {
    query: result.query,
    engine,
    assetDetected: parsed.sources?.kpi?.asset_detected || false,
    assetPosition: assetIndex >= 0 ? assetIndex + 1 : undefined,
    competitors,
    totalSources: parsed.sources?.metadata?.number_of_sources || 0,
    usedSources: parsed.sources?.metadata?.number_of_used_sources || 0,
    topDomains: parsed.sources?.kpi?.used_domains || [],
    grounding: groundingScores.length
      ? groundingScores.reduce((sum, g) => sum + g.cosine_similarity, 0) / groundingScores.length
      : undefined,
    llmText: parsed.llm_output?.text,
    searchQueries: parsed.queries || [],
    allSourceUrls: parsed.sources?.metadata?.all_sources || [],
    usedSourcesList: parsed.sources?.metadata?.used_sources || [],
    rankedAssets: assetsSorted,
    targetAsset: result.assets,
    scrapedSources: (parsed.sources?.metadata?.used_source_with_markdown || [])
      .filter((entry): entry is [string, string] => !!entry[1])
      .map(([url, markdown]) => ({ url, markdown })),
    groundingSegments: groundingScores,
  };
};

const aggregateResults = (results: AuditResult[]): DashboardData[] => {
  return results.flatMap(result => {
    const data: DashboardData[] = [];
    if (result.geminiResponse) data.push(buildDashboardEntry(result, 'gemini', result.geminiResponse));
    if (result.openaiResponse) data.push(buildDashboardEntry(result, 'openai', result.openaiResponse));
    return data;
  });
};

function SourceList({ title, sources, emptyLabel }: { title: string; sources: SourceRef[]; emptyLabel: string }) {
  return (
    <div>
      <div className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
        {title} ({sources.length})
      </div>
      {sources.length > 0 ? (
        <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
          {sources.map((s, i) => (
            <li key={`${s.url}-${i}`}>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate rounded px-2 py-1.5 text-xs hover:underline"
                style={{ backgroundColor: 'var(--panel)', color: 'var(--primary)' }}
                title={s.url}
              >
                {s.title || getDomain(s.url)}
                <span className="ml-1" style={{ color: 'var(--text-secondary)' }}>· {getDomain(s.url)}</span>
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{emptyLabel}</div>
      )}
    </div>
  );
}

function QueryDetailModal({ row, onClose }: { row: DashboardData; onClose: () => void }) {
  const targetAsset = row.targetAsset;
  const usedUrls = new Set(row.usedSourcesList.map(s => s.url));
  const unusedSources: SourceRef[] = row.allSourceUrls
    .filter(url => !usedUrls.has(url))
    .map(url => ({ title: '', url }));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl rounded-[22px] border shadow-xl"
        style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel-alt)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b p-5" style={{ borderColor: 'var(--stroke)' }}>
          <div>
            <div className="flex items-center gap-2">
              <span className="capitalize rounded px-2 py-1 text-xs font-medium" style={{
                backgroundColor: row.engine === 'gemini' ? '#ecfdf5' : '#fef3f2',
                color: row.engine === 'gemini' ? '#059669' : '#991b1b'
              }}>
                {row.engine}
              </span>
              {targetAsset && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Asset: {targetAsset}</span>}
            </div>
            <h3 className="mt-2 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>{row.query}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-full px-2.5 py-1 text-sm"
            style={{ backgroundColor: 'var(--panel)', color: 'var(--text-secondary)' }}
          >
            ✕
          </button>
        </div>

        <div className="space-y-6 p-5">
          {/* KPI strip */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}>
              <div className="text-[11px] uppercase" style={{ color: 'var(--text-secondary)' }}>Brand Detected</div>
              <div className="mt-1 text-lg font-bold" style={{ color: row.assetDetected ? '#059669' : '#dc2626' }}>
                {row.assetDetected ? '✓ Yes' : '○ No'}
              </div>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}>
              <div className="text-[11px] uppercase" style={{ color: 'var(--text-secondary)' }}>Position</div>
              <div className="mt-1 text-lg font-bold" style={{ color: 'var(--primary)' }}>
                {row.assetPosition !== undefined ? `#${row.assetPosition}` : '-'}
              </div>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}>
              <div className="text-[11px] uppercase" style={{ color: 'var(--text-secondary)' }}>Sources Used</div>
              <div className="mt-1 text-lg font-bold" style={{ color: 'var(--primary)' }}>
                {row.usedSources}/{row.totalSources}
              </div>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}>
              <div className="text-[11px] uppercase" style={{ color: 'var(--text-secondary)' }}>Grounding</div>
              <div className="mt-1 text-lg font-bold" style={{ color: 'var(--primary)' }}>
                {row.grounding !== undefined ? `${Math.round(row.grounding * 100)}%` : 'N/A'}
              </div>
            </div>
          </div>

          {/* Search queries issued by the engine */}
          {row.searchQueries.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                Search Queries Issued ({row.searchQueries.length})
              </div>
              <div className="flex flex-wrap gap-2">
                {row.searchQueries.map((q, i) => (
                  <span key={i} className="rounded-full px-3 py-1 text-xs" style={{ backgroundColor: 'var(--panel)', color: 'var(--text-secondary)' }}>
                    {q}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Brand & competitor ranking */}
          {row.rankedAssets.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                Brand & Competitor Ranking
              </div>
              <ol className="space-y-1">
                {row.rankedAssets.map((a, i) => {
                  const isTarget = a.asset.toLowerCase() === targetAsset.toLowerCase();
                  return (
                    <li
                      key={`${a.asset}-${i}`}
                      className="flex items-center justify-between rounded px-3 py-1.5 text-sm"
                      style={{
                        backgroundColor: isTarget ? 'var(--primary-soft)' : 'var(--panel)',
                        color: isTarget ? 'var(--primary-strong)' : 'var(--foreground)',
                        fontWeight: isTarget ? 600 : 400,
                      }}
                    >
                      <span>#{i + 1} {a.asset}{isTarget ? ' (your brand)' : ''}</span>
                      <span style={{ color: 'var(--text-secondary)' }}>{a.count} mention{a.count > 1 ? 's' : ''}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {/* LLM answer */}
          {row.llmText && (
            <div>
              <div className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                LLM Answer
              </div>
              <div
                className="prose prose-sm max-h-64 max-w-none overflow-y-auto rounded-lg border p-3 text-sm leading-6"
                style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)', color: 'var(--foreground)' }}
                dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(mdParse(row.llmText) as string) }}
              />
            </div>
          )}

          {/* Grounded answer segments (Gemini only) */}
          {row.groundingSegments.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                Grounded Answer Segments ({row.groundingSegments.length})
              </div>
              <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {row.groundingSegments.map((seg, i) => (
                  <li
                    key={i}
                    className="rounded-lg border p-3 text-sm"
                    style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)', color: 'var(--foreground)' }}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>
                        Segment {i + 1}
                      </span>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary-strong)' }}
                      >
                        {Math.round(seg.cosine_similarity * 100)}% match
                      </span>
                    </div>
                    {seg.text}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Sources */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <SourceList title="Sources Used" sources={row.usedSourcesList} emptyLabel="No used-source detail available." />
            <SourceList title="Sources Consulted, Not Used" sources={unusedSources} emptyLabel="No unused-source detail available." />
          </div>

          {/* Scraped content of used sources */}
          {row.scrapedSources.length > 0 && (
            <div>
              <div className="mb-2 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
                Scraped Content ({row.scrapedSources.length})
              </div>
              <div className="space-y-2">
                {row.scrapedSources.map((s, i) => (
                  <details key={i} className="rounded-lg border" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}>
                    <summary
                      className="cursor-pointer select-none px-3 py-2 text-sm font-medium"
                      style={{ color: 'var(--primary)' }}
                    >
                      {getDomain(s.url)}
                    </summary>
                    <div className="border-t px-3 py-3" style={{ borderColor: 'var(--stroke)' }}>
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-2 block truncate text-xs hover:underline"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {s.url}
                      </a>
                      <div
                        className="prose prose-sm max-h-64 max-w-none overflow-y-auto text-sm leading-6"
                        style={{ color: 'var(--foreground)' }}
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(mdParse(s.markdown) as string) }}
                      />
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GeoMonitoringDashboard({ results }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [engineFilter, setEngineFilter] = useState<'all' | 'gemini' | 'openai'>('all');
  const [assetFilter, setAssetFilter] = useState<'all' | 'detected' | 'notDetected'>('all');
  const [selectedRow, setSelectedRow] = useState<DashboardData | null>(null);

  const dashboardData = useMemo(() => aggregateResults(results), [results]);

  // KPI Calculations
  const kpis = useMemo(() => {
    const gemini = dashboardData.filter(d => d.engine === 'gemini');
    const openai = dashboardData.filter(d => d.engine === 'openai');

    const calcVisibility = (data: DashboardData[]) => {
      if (data.length === 0) return 0;
      return Math.round((data.filter(d => d.assetDetected).length / data.length) * 100);
    };

    const calcAvgPosition = (data: DashboardData[]) => {
      const detected = data.filter(d => d.assetDetected && d.assetPosition !== undefined);
      if (detected.length === 0) return 0;
      return (detected.reduce((sum, d) => sum + (d.assetPosition || 0), 0) / detected.length).toFixed(1);
    };

    return {
      globalVisibility: calcVisibility(dashboardData),
      geminiVisibility: calcVisibility(gemini),
      openaiVisibility: calcVisibility(openai),
      globalAvgPosition: calcAvgPosition(dashboardData),
      geminiAvgPosition: calcAvgPosition(gemini),
      openaiAvgPosition: calcAvgPosition(openai),
      totalQueries: dashboardData.length,
    };
  }, [dashboardData]);

  // Competitors aggregation
  const competitorsData = useMemo(() => {
    const competitorMap: Record<string, number> = {};
    dashboardData.forEach(d => {
      d.competitors.forEach(c => {
        competitorMap[c.name] = (competitorMap[c.name] || 0) + 1;
      });
    });
    return Object.entries(competitorMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [dashboardData]);

  // Sources aggregation
  const sourcesData = useMemo(() => {
    const domainMap: Record<string, number> = {};
    dashboardData.forEach(d => {
      d.topDomains.forEach(([domain, count]) => {
        domainMap[domain] = (domainMap[domain] || 0) + count;
      });
    });
    return Object.entries(domainMap)
      .map(([domain, count]) => ({ domain, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [dashboardData]);

  // Reformulated search queries: word frequency
  const allSearchQueries = useMemo(
    () => dashboardData.flatMap(d => d.searchQueries),
    [dashboardData]
  );

  const topReformulatedWords = useMemo(() => {
    const wordCounts: Record<string, number> = {};
    allSearchQueries.forEach(q => {
      tokenizeQuery(q).forEach(word => {
        wordCounts[word] = (wordCounts[word] || 0) + 1;
      });
    });
    return Object.entries(wordCounts)
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [allSearchQueries]);

  // Position distribution
  const positionDistribution = useMemo(() => {
    const positions: Record<number, number> = {};
    dashboardData
      .filter(d => d.assetDetected && d.assetPosition !== undefined)
      .forEach(d => {
        const pos = d.assetPosition || 0;
        positions[pos] = (positions[pos] || 0) + 1;
      });
    return Object.entries(positions)
      .map(([pos, count]) => ({ position: `#${pos}`, count }))
      .sort((a, b) => parseInt(a.position.slice(1)) - parseInt(b.position.slice(1)))
      .slice(0, 10);
  }, [dashboardData]);

  // Filter data for table
  const filteredData = useMemo(() => {
    return dashboardData.filter(d => {
      const matchEngine = engineFilter === 'all' || d.engine === engineFilter;
      const matchAsset = assetFilter === 'all' ||
        (assetFilter === 'detected' && d.assetDetected) ||
        (assetFilter === 'notDetected' && !d.assetDetected);
      const matchGlobal = !globalFilter ||
        d.query.toLowerCase().includes(globalFilter.toLowerCase()) ||
        d.engine.toLowerCase().includes(globalFilter.toLowerCase());
      return matchEngine && matchAsset && matchGlobal;
    });
  }, [dashboardData, engineFilter, assetFilter, globalFilter]);

  // React Table setup
  const columnHelper = createColumnHelper<DashboardData>();
  const columns = [
    columnHelper.accessor('query', {
      header: 'Query',
      cell: (info: any) => <span className="truncate max-w-xs">{info.getValue()}</span>,
    }),
    columnHelper.accessor('engine', {
      header: 'Engine',
      cell: (info: any) => (
        <span className="capitalize px-2 py-1 rounded text-xs font-medium" style={{
          backgroundColor: info.getValue() === 'gemini' ? '#ecfdf5' : '#fef3f2',
          color: info.getValue() === 'gemini' ? '#059669' : '#991b1b'
        }}>
          {info.getValue()}
        </span>
      ),
    }),
    columnHelper.accessor('assetDetected', {
      header: 'Brand Detected',
      cell: (info: any) => (
        <span style={{
          color: info.getValue() ? '#059669' : '#dc2626',
          fontWeight: 'bold'
        }}>
          {info.getValue() ? '✓' : '○'}
        </span>
      ),
    }),
    columnHelper.accessor('assetPosition', {
      header: 'Position',
      cell: (info: any) => info.getValue() !== undefined ? `#${info.getValue()}` : '-',
    }),
    columnHelper.accessor('usedSources', {
      header: 'Sources Used',
      cell: (info: any) => `${info.getValue()}/${dashboardData.find(d => d.query === info.row.original.query && d.engine === info.row.original.engine)?.totalSources || 0}`,
    }),
    columnHelper.display({
      id: 'details',
      header: '',
      cell: (info: any) => (
        <button
          onClick={(e) => { e.stopPropagation(); setSelectedRow(info.row.original); }}
          className="rounded px-2 py-1 text-xs font-medium"
          style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}
        >
          View →
        </button>
      ),
    }),
  ];

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-8 py-6 w-full max-w-full">
      {/* Bloc 1: Visibilité Marque (KPI Principal) */}
      <section className="w-full rounded-[22px] border p-6 box-border overflow-x-auto" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel-alt)' }}>
        <h2 className="mb-6 text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          📊 Brand Visibility (Share of Voice)
        </h2>

        {/* Hero Metric */}
        <div className="mb-6 rounded-lg p-6 text-center" style={{ backgroundColor: 'var(--primary-soft)' }}>
          <div className="text-6xl font-bold" style={{ color: 'var(--primary)' }}>
            {kpis.globalVisibility}%
          </div>
          <div className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
            Global visibility rate across {kpis.totalQueries} queries
          </div>
        </div>

        {/* Engine Comparison Cards */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}>
            <div className="text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>Gemini</div>
            <div className="mt-2 text-3xl font-bold" style={{ color: 'var(--primary)' }}>{kpis.geminiVisibility}%</div>
            <div className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Avg Position: #{kpis.geminiAvgPosition}
            </div>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}>
            <div className="text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>OpenAI</div>
            <div className="mt-2 text-3xl font-bold" style={{ color: 'var(--primary)' }}>{kpis.openaiVisibility}%</div>
            <div className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Avg Position: #{kpis.openaiAvgPosition}
            </div>
          </div>
        </div>

        {/* Position Distribution Chart */}
        {positionDistribution.length > 0 && (
          <div style={{ width: '100%', height: 300, maxWidth: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={positionDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="position" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="var(--primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Bloc 2: Paysage Concurrentiel */}
      <section className="w-full rounded-[22px] border p-6 box-border overflow-x-auto" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel-alt)' }}>
        <h2 className="mb-6 text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          🏆 Competitive Landscape
        </h2>

        {competitorsData.length > 0 ? (
          <div style={{ width: '100%', height: 400, maxWidth: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={competitorsData} layout="vertical" margin={{ left: 80, right: 30, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={70} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-center py-8" style={{ color: 'var(--text-secondary)' }}>
            No competitor data available
          </div>
        )}
      </section>

      {/* Bloc 3: Analyse des Sources */}
      <section className="w-full rounded-[22px] border p-6 box-border overflow-x-auto" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel-alt)' }}>
        <h2 className="mb-6 text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          📚 Source Analysis
        </h2>

        {/* Source Statistics */}
        <div className="mb-6 grid grid-cols-3 gap-4">
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}>
            <div className="text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>Avg Sources Consulted</div>
            <div className="mt-2 text-2xl font-bold" style={{ color: 'var(--primary)' }}>
              {(dashboardData.reduce((sum, d) => sum + d.totalSources, 0) / Math.max(dashboardData.length, 1)).toFixed(1)}
            </div>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}>
            <div className="text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>Avg Sources Used</div>
            <div className="mt-2 text-2xl font-bold" style={{ color: 'var(--primary)' }}>
              {(dashboardData.reduce((sum, d) => sum + d.usedSources, 0) / Math.max(dashboardData.length, 1)).toFixed(1)}
            </div>
          </div>
          <div className="rounded-lg border p-4" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}>
            <div className="text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>Avg Utilization</div>
            <div className="mt-2 text-2xl font-bold" style={{ color: 'var(--primary)' }}>
              {dashboardData.length > 0
                ? Math.round((dashboardData.reduce((sum, d) => sum + (d.totalSources > 0 ? (d.usedSources / d.totalSources) : 0), 0) / dashboardData.length) * 100)
                : 0}%
            </div>
          </div>
        </div>

        {/* Top Domains Chart */}
        {sourcesData.length > 0 && (
          <div style={{ width: '100%', height: 350, maxWidth: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourcesData} margin={{ bottom: 80, left: 30, right: 30, top: 10 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="domain" angle={-45} textAnchor="end" height={80} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" fill="var(--primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Reformulated Queries — Top Words */}
        {topReformulatedWords.length > 0 && (
          <div className="mt-8">
            <h3 className="mb-1 text-sm font-semibold" style={{ color: 'var(--foreground)' }}>
              💬 Reformulated Queries — Top 5 Words
            </h3>
            <p className="mb-4 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Based on {allSearchQueries.length} search {allSearchQueries.length > 1 ? 'queries' : 'query'} issued by the engines, across all rows.
            </p>
            <div style={{ width: '100%', height: 220, maxWidth: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topReformulatedWords} layout="vertical" margin={{ left: 70, right: 30, top: 10, bottom: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis dataKey="word" type="category" width={90} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="var(--primary)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </section>

      {/* Bloc 4: Détail par Requête */}
      <section className="w-full rounded-[22px] border p-6 box-border overflow-x-auto" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel-alt)' }}>
        <h2 className="mb-6 text-xl font-semibold" style={{ color: 'var(--foreground)' }}>
          🔍 Detailed Query Results
        </h2>

        {/* Filters */}
        <div className="mb-6 space-y-4">
          <input
            placeholder="Search queries..."
            value={globalFilter}
            onChange={e => setGlobalFilter(e.target.value)}
            className="w-full rounded-lg border px-4 py-2 text-sm"
            style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}
          />
          <div className="flex gap-3">
            <select
              value={engineFilter}
              onChange={e => setEngineFilter(e.target.value as any)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}
            >
              <option value="all">All Engines</option>
              <option value="gemini">Gemini</option>
              <option value="openai">OpenAI</option>
            </select>
            <select
              value={assetFilter}
              onChange={e => setAssetFilter(e.target.value as any)}
              className="rounded-lg border px-3 py-2 text-sm"
              style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}
            >
              <option value="all">All Results</option>
              <option value="detected">Brand Detected</option>
              <option value="notDetected">Brand Not Detected</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="w-full overflow-x-auto rounded-lg border" style={{ borderColor: 'var(--stroke)' }}>
          <table className="min-w-full text-sm">
            <thead style={{ borderBottom: `2px solid var(--stroke)` }}>
              {table.getHeaderGroups().map((headerGroup: any) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header: any) => (
                    <th
                      key={header.id}
                      className="px-4 py-3 text-left font-semibold"
                      style={{ color: 'var(--primary-strong)' }}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length > 0 ? (
                table.getRowModel().rows.map((row: any) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedRow(row.original)}
                    className="cursor-pointer transition-colors"
                    style={{ borderBottom: `1px solid var(--stroke)` }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'var(--surface-soft)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent'; }}
                  >
                    {row.getVisibleCells().map((cell: any) => (
                      <td key={cell.id} className="px-4 py-3" style={{ color: 'var(--foreground)' }}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-8 text-center" style={{ color: 'var(--text-secondary)' }}>
                    No results found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount() || 1} |
            Total: {filteredData.length} results
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="rounded px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}
            >
              ← Previous
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="rounded px-3 py-2 text-sm"
              style={{ backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}
            >
              Next →
            </button>
          </div>
        </div>
      </section>

      {selectedRow && <QueryDetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />}
    </div>
  );
}
