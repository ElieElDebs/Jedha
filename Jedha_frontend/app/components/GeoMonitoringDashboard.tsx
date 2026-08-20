"use client";
import { useMemo, useState } from 'react';
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

interface ParsedResponse {
  llm_output_text?: string;
  sources_kpi_asset_detected?: boolean;
  sources_kpi_assets_and_competitors_sorted?: Array<{ name: string; position: number }>;
  sources_metadata_number_of_sources?: number;
  sources_metadata_number_of_used_sources?: number;
  sources_kpi_used_domains?: Array<[string, number]>;
  sources_kpi_grounding_cosine_similarities?: number[];
  competitors?: Array<{ name: string; positionning: number }>;
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
}

type Props = {
  results: AuditResult[];
};

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

const aggregateResults = (results: AuditResult[]): DashboardData[] => {
  return results.flatMap(result => {
    const data: DashboardData[] = [];

    if (result.geminiResponse) {
      const parsed = parseJsonResponse(result.geminiResponse);
      const competitors = parsed.competitors || [];
      const assetPositioning = parsed.sources_kpi_assets_and_competitors_sorted || [];
      const assetData = assetPositioning.find((a: any) => a.name?.toLowerCase() === result.assets.toLowerCase());

      data.push({
        query: result.query,
        engine: 'gemini',
        assetDetected: parsed.sources_kpi_asset_detected || false,
        assetPosition: assetData?.position,
        competitors,
        totalSources: parsed.sources_metadata_number_of_sources || 0,
        usedSources: parsed.sources_metadata_number_of_used_sources || 0,
        topDomains: parsed.sources_kpi_used_domains || [],
        grounding: parsed.sources_kpi_grounding_cosine_similarities?.length
          ? parsed.sources_kpi_grounding_cosine_similarities.reduce((a, b) => a + b, 0) / parsed.sources_kpi_grounding_cosine_similarities.length
          : undefined,
        llmText: parsed.llm_output_text,
      });
    }

    if (result.openaiResponse) {
      const parsed = parseJsonResponse(result.openaiResponse);
      const competitors = parsed.competitors || [];
      const assetPositioning = parsed.sources_kpi_assets_and_competitors_sorted || [];
      const assetData = assetPositioning.find((a: any) => a.name?.toLowerCase() === result.assets.toLowerCase());

      data.push({
        query: result.query,
        engine: 'openai',
        assetDetected: parsed.sources_kpi_asset_detected || false,
        assetPosition: assetData?.position,
        competitors,
        totalSources: parsed.sources_metadata_number_of_sources || 0,
        usedSources: parsed.sources_metadata_number_of_used_sources || 0,
        topDomains: parsed.sources_kpi_used_domains || [],
        grounding: parsed.sources_kpi_grounding_cosine_similarities?.length
          ? parsed.sources_kpi_grounding_cosine_similarities.reduce((a, b) => a + b, 0) / parsed.sources_kpi_grounding_cosine_similarities.length
          : undefined,
        llmText: parsed.llm_output_text,
      });
    }

    return data;
  });
};

export default function GeoMonitoringDashboard({ results }: Props) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [engineFilter, setEngineFilter] = useState<'all' | 'gemini' | 'openai'>('all');
  const [assetFilter, setAssetFilter] = useState<'all' | 'detected' | 'notDetected'>('all');

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
                  <tr key={row.id} style={{ borderBottom: `1px solid var(--stroke)` }}>
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
    </div>
  );
}
