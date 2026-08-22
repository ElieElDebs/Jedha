"use client";
import { useMemo, useRef, useState } from 'react';
import { parse as mdParse } from 'marked';
import DOMPurify from 'dompurify';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import html2canvas from 'html2canvas';
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
      used_source_with_markdown?: Array<[string, string | null, RankedAsset[] | null]>;
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
  scrapedSources: Array<{ url: string; markdown: string; assetMatches: RankedAsset[] }>;
  groundingSegments: Array<{ text: string; cosine_similarity: number }>;
  assetDetectedInSources: boolean;
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

const markdownToPlainText = (markdown: string): string =>
  markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/^>\s?/gm, '')
    .replace(/^[-*+]\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

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
  const scrapedSources = (parsed.sources?.metadata?.used_source_with_markdown || [])
    .filter((entry): entry is [string, string, RankedAsset[] | null] => !!entry[1])
    .map(([url, markdown, assetMatches]) => ({ url, markdown, assetMatches: assetMatches || [] }));

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
    scrapedSources,
    groundingSegments: groundingScores,
    assetDetectedInSources: scrapedSources.some((s) => s.assetMatches.some((a) => a.count > 0)),
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}>
              <div className="text-[11px] uppercase" style={{ color: 'var(--text-secondary)' }}>Brand Detected</div>
              <div className="mt-1 text-lg font-bold" style={{ color: row.assetDetected ? '#059669' : '#dc2626' }}>
                {row.assetDetected ? '✓ Yes' : '○ No'}
              </div>
            </div>
            <div className="rounded-lg border p-3" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}>
              <div className="text-[11px] uppercase" style={{ color: 'var(--text-secondary)' }}>In Sources</div>
              <div className="mt-1 text-lg font-bold" style={{ color: row.assetDetectedInSources ? '#059669' : '#dc2626' }}>
                {row.assetDetectedInSources ? '✓ Yes' : '○ No'}
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
                {row.scrapedSources.map((s, i) => {
                  const detectedMatches = s.assetMatches.filter((a) => a.count > 0);
                  return (
                    <details key={i} className="rounded-lg border" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}>
                      <summary
                        className="flex cursor-pointer select-none items-center justify-between gap-2 px-3 py-2 text-sm font-medium"
                        style={{ color: 'var(--primary)' }}
                      >
                        <span>{getDomain(s.url)}</span>
                        {detectedMatches.length > 0 && (
                          <span
                            className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                            style={{ backgroundColor: '#ecfdf5', color: '#059669' }}
                          >
                            ✓ Brand mentioned ({detectedMatches.reduce((sum, a) => sum + a.count, 0)}x)
                          </span>
                        )}
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
                  );
                })}
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
  const [generatingPdf, setGeneratingPdf] = useState(false);

  const positionChartRef = useRef<HTMLDivElement>(null);
  const competitorChartRef = useRef<HTMLDivElement>(null);
  const domainsChartRef = useRef<HTMLDivElement>(null);
  const wordsChartRef = useRef<HTMLDivElement>(null);

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

    const calcSourceDetectionRate = (data: DashboardData[]) => {
      if (data.length === 0) return 0;
      return Math.round((data.filter(d => d.assetDetectedInSources).length / data.length) * 100);
    };

    return {
      globalVisibility: calcVisibility(dashboardData),
      geminiVisibility: calcVisibility(gemini),
      openaiVisibility: calcVisibility(openai),
      globalAvgPosition: calcAvgPosition(dashboardData),
      geminiAvgPosition: calcAvgPosition(gemini),
      openaiAvgPosition: calcAvgPosition(openai),
      totalQueries: dashboardData.length,
      sourceDetectionRate: calcSourceDetectionRate(dashboardData),
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
    columnHelper.accessor('assetDetectedInSources', {
      header: 'In Sources',
      cell: (info: any) => (
        <span style={{
          color: info.getValue() ? '#059669' : '#dc2626',
          fontWeight: 'bold'
        }}>
          {info.getValue() ? '✓' : '○'}
        </span>
      ),
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

  const captureChart = async (el: HTMLDivElement | null): Promise<{ dataUrl: string; ratio: number } | null> => {
    if (!el) return null;
    const canvas = await html2canvas(el, { scale: 1.5, backgroundColor: '#ffffff' });
    return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), ratio: canvas.width / canvas.height };
  };

  const handleDownloadPdf = async () => {
    if (dashboardData.length === 0) return;
    setGeneratingPdf(true);
    try {
      const [positionImg, competitorImg, domainsImg, wordsImg] = await Promise.all([
        captureChart(positionChartRef.current),
        captureChart(competitorChartRef.current),
        captureChart(domainsChartRef.current),
        captureChart(wordsChartRef.current),
      ]);

      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 14;
      const contentWidth = pageWidth - margin * 2;
      let y = margin;

      const ensureSpace = (needed: number) => {
        if (y + needed > pageHeight - margin) {
          doc.addPage();
          y = margin;
        }
      };

      const addHeading = (text: string) => {
        ensureSpace(10);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(text, margin, y);
        y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
      };

      const addChartImage = (chart: { dataUrl: string; ratio: number } | null, heading: string) => {
        if (!chart) return;
        const imgHeight = contentWidth / chart.ratio;
        ensureSpace(10 + imgHeight + 8);
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(40, 40, 40);
        doc.text(heading, margin, y);
        y += 7;
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        doc.addImage(chart.dataUrl, 'JPEG', margin, y, contentWidth, imgHeight);
        y += imgHeight + 8;
      };

      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('GEO Audit Report', margin, y);
      y += 8;
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(120, 120, 120);
      doc.text(
        `Generated ${new Date().toLocaleString()} - ${dashboardData.length} result(s) across ${new Set(dashboardData.map(d => d.query)).size} quer${new Set(dashboardData.map(d => d.query)).size > 1 ? 'ies' : 'y'}`,
        margin, y
      );
      doc.setTextColor(0, 0, 0);
      y += 10;

      // KPI summary
      addHeading('Brand Visibility');
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9 },
        head: [['Metric', 'Value']],
        body: [
          ['Global visibility rate', `${kpis.globalVisibility}%`],
          ['Gemini visibility', `${kpis.geminiVisibility}% (avg position #${kpis.geminiAvgPosition})`],
          ['OpenAI visibility', `${kpis.openaiVisibility}% (avg position #${kpis.openaiAvgPosition})`],
          ['Detected in consulted sources', `${kpis.sourceDetectionRate}%`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [168, 213, 186], textColor: [40, 40, 40] },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      addChartImage(positionImg, 'Position Distribution');
      addChartImage(competitorImg, 'Competitive Landscape');

      // Source analysis stats
      addHeading('Source Analysis');
      const avgConsulted = dashboardData.reduce((sum, d) => sum + d.totalSources, 0) / Math.max(dashboardData.length, 1);
      const avgUsed = dashboardData.reduce((sum, d) => sum + d.usedSources, 0) / Math.max(dashboardData.length, 1);
      const avgUtilization = dashboardData.length > 0
        ? Math.round((dashboardData.reduce((sum, d) => sum + (d.totalSources > 0 ? d.usedSources / d.totalSources : 0), 0) / dashboardData.length) * 100)
        : 0;
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        styles: { fontSize: 9 },
        head: [['Metric', 'Value']],
        body: [
          ['Avg sources consulted', avgConsulted.toFixed(1)],
          ['Avg sources used', avgUsed.toFixed(1)],
          ['Avg utilization', `${avgUtilization}%`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [168, 213, 186], textColor: [40, 40, 40] },
      });
      y = (doc as any).lastAutoTable.finalY + 8;

      addChartImage(domainsImg, 'Top Domains');
      addChartImage(wordsImg, 'Reformulated Queries - Top Words');

      // Detailed query results
      addHeading('Detailed Query Results');
      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        styles: { fontSize: 8 },
        head: [['Query', 'Engine', 'Brand Detected', 'In Sources', 'Position', 'Sources Used']],
        body: dashboardData.map(d => [
          d.query,
          d.engine,
          d.assetDetected ? 'Yes' : 'No',
          d.assetDetectedInSources ? 'Yes' : 'No',
          d.assetPosition !== undefined ? `#${d.assetPosition}` : '-',
          `${d.usedSources}/${d.totalSources}`,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [168, 213, 186], textColor: [40, 40, 40] },
        columnStyles: { 0: { cellWidth: contentWidth * 0.4 } },
      });

      // Per-query detail (mirrors the "View" modal), one section per query/engine pair.
      dashboardData.forEach((d, index) => {
        doc.addPage();
        y = margin;

        doc.setFillColor(232, 243, 237);
        doc.rect(margin, y, contentWidth, 9, 'F');
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        doc.text(`Query ${index + 1} of ${dashboardData.length} - ${d.engine.toUpperCase()} - Asset: ${d.targetAsset}`, margin + 3, y + 6);
        y += 13;
        doc.setTextColor(0, 0, 0);

        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        const queryLines = doc.splitTextToSize(d.query, contentWidth);
        doc.text(queryLines, margin, y);
        y += queryLines.length * 6 + 4;
        doc.setFont('helvetica', 'normal');

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          styles: { fontSize: 8 },
          head: [['Brand Detected', 'In Sources', 'Position', 'Sources Used', 'Grounding']],
          body: [[
            d.assetDetected ? 'Yes' : 'No',
            d.assetDetectedInSources ? 'Yes' : 'No',
            d.assetPosition !== undefined ? `#${d.assetPosition}` : '-',
            `${d.usedSources}/${d.totalSources}`,
            d.grounding !== undefined ? `${Math.round(d.grounding * 100)}%` : 'N/A',
          ]],
          theme: 'grid',
          headStyles: { fillColor: [168, 213, 186], textColor: [40, 40, 40] },
        });
        y = (doc as any).lastAutoTable.finalY + 6;

        const addSubheading = (text: string) => {
          ensureSpace(10);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text(text, margin, y);
          y += 5;
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
        };

        if (d.searchQueries.length > 0) {
          addSubheading('Search Queries Issued');
          const qLines = doc.splitTextToSize(d.searchQueries.join('   •   '), contentWidth);
          ensureSpace(qLines.length * 4.5 + 4);
          doc.text(qLines, margin, y);
          y += qLines.length * 4.5 + 6;
        }

        if (d.rankedAssets.length > 0) {
          addSubheading('Brand & Competitor Ranking');
          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            styles: { fontSize: 8 },
            head: [['#', 'Asset', 'Mentions']],
            body: d.rankedAssets.map((a, i) => [
              String(i + 1),
              a.asset.toLowerCase() === d.targetAsset.toLowerCase() ? `* ${a.asset} (your brand)` : a.asset,
              String(a.count),
            ]),
            theme: 'striped',
            headStyles: { fillColor: [168, 213, 186], textColor: [40, 40, 40] },
          });
          y = (doc as any).lastAutoTable.finalY + 6;
        }

        if (d.llmText) {
          addSubheading('LLM Answer');
          const lines = doc.splitTextToSize(markdownToPlainText(d.llmText), contentWidth);
          lines.forEach((line: string) => {
            ensureSpace(4.5);
            doc.text(line, margin, y);
            y += 4.5;
          });
          y += 4;
        }

        if (d.groundingSegments.length > 0) {
          addSubheading('Grounded Answer Segments');
          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            styles: { fontSize: 8 },
            head: [['Segment', 'Match']],
            body: d.groundingSegments.map(s => [s.text, `${Math.round(s.cosine_similarity * 100)}%`]),
            columnStyles: { 0: { cellWidth: contentWidth - 25 }, 1: { cellWidth: 25 } },
            theme: 'striped',
            headStyles: { fillColor: [168, 213, 186], textColor: [40, 40, 40] },
          });
          y = (doc as any).lastAutoTable.finalY + 6;
        }

        const usedUrls = new Set(d.usedSourcesList.map(s => s.url));
        const unusedUrls = d.allSourceUrls.filter(u => !usedUrls.has(u));

        if (d.usedSourcesList.length > 0) {
          addSubheading(`Sources Used (${d.usedSourcesList.length})`);
          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            styles: { fontSize: 7.5 },
            body: d.usedSourcesList.map(s => [s.title || getDomain(s.url), s.url]),
            theme: 'plain',
            columnStyles: {
              0: { cellWidth: contentWidth * 0.35, fontStyle: 'bold' },
              1: { textColor: [90, 130, 200] },
            },
          });
          y = (doc as any).lastAutoTable.finalY + 6;
        }

        if (unusedUrls.length > 0) {
          addSubheading(`Sources Consulted, Not Used (${unusedUrls.length})`);
          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            styles: { fontSize: 7.5, textColor: [110, 110, 110] },
            body: unusedUrls.map(u => [u]),
            theme: 'plain',
          });
          y = (doc as any).lastAutoTable.finalY + 6;
        }

        if (d.scrapedSources.length > 0) {
          addSubheading(`Scraped Content (${d.scrapedSources.length})`);
          autoTable(doc, {
            startY: y,
            margin: { left: margin, right: margin },
            styles: { fontSize: 7.5 },
            head: [['Source', 'Brand Mentioned', 'Excerpt']],
            body: d.scrapedSources.map(s => {
              const matches = s.assetMatches.filter(a => a.count > 0);
              const mentioned = matches.length > 0
                ? `Yes (${matches.reduce((sum, a) => sum + a.count, 0)}x)`
                : 'No';
              const plain = markdownToPlainText(s.markdown);
              const excerpt = plain.slice(0, 220).trim() + (plain.length > 220 ? '…' : '');
              return [getDomain(s.url), mentioned, excerpt];
            }),
            theme: 'striped',
            headStyles: { fillColor: [168, 213, 186], textColor: [40, 40, 40] },
            columnStyles: { 0: { cellWidth: contentWidth * 0.2 }, 1: { cellWidth: contentWidth * 0.18 } },
          });
          y = (doc as any).lastAutoTable.finalY + 6;
        }
      });

      doc.save(`geo-report-${new Date().toISOString().split('T')[0]}.pdf`);
    } finally {
      setGeneratingPdf(false);
    }
  };

  return (
    <div className="space-y-8 py-6 w-full max-w-full">
      {dashboardData.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={handleDownloadPdf}
            disabled={generatingPdf}
            className="material-button-primary text-sm"
          >
            {generatingPdf ? 'Generating PDF...' : '📄 Download PDF'}
          </button>
        </div>
      )}

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

        {/* Detected in Consulted Sources */}
        <div
          className="mb-6 flex items-center justify-between rounded-lg border p-4"
          style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}
        >
          <div>
            <div className="text-xs font-semibold uppercase" style={{ color: 'var(--text-secondary)' }}>
              Detected in Consulted Sources
            </div>
            <div className="mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Brand found in the scraped source pages, regardless of whether it made it into the final answer
            </div>
          </div>
          <div className="shrink-0 text-3xl font-bold" style={{ color: 'var(--primary)' }}>
            {kpis.sourceDetectionRate}%
          </div>
        </div>

        {/* Position Distribution Chart */}
        {positionDistribution.length > 0 && (
          <div ref={positionChartRef} style={{ width: '100%', height: 300, maxWidth: '100%' }}>
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
          <div ref={competitorChartRef} style={{ width: '100%', height: 400, maxWidth: '100%' }}>
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
          <div ref={domainsChartRef} style={{ width: '100%', height: 350, maxWidth: '100%' }}>
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
            <div ref={wordsChartRef} style={{ width: '100%', height: 220, maxWidth: '100%' }}>
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
