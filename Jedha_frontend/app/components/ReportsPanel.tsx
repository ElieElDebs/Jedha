"use client";
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import GeoMonitoringDashboard from './GeoMonitoringDashboard';

interface ReportRow {
  query: string;
  assets: string;
}

interface ReportResult extends ReportRow {
  status: 'pending' | 'success' | 'error';
  geminiResponse?: any;
  openaiResponse?: any;
  error?: string;
}

export default function ReportsPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importFileInputRef = useRef<HTMLInputElement>(null);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [results, setResults] = useState<ReportResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: ['query', 'assets'] });

        const validRows: ReportRow[] = jsonData
          .filter((row: any) => row.query && row.assets)
          .map((row: any) => ({
            query: String(row.query).trim(),
            assets: String(row.assets).trim(),
          }));

        setRows(validRows);
        setResults(validRows.map(row => ({ ...row, status: 'pending' })));
      } catch (error) {
        alert(`Error reading file: ${error}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const safeJsonParse = (value: any, fallback: any): any => {
    if (!value) return fallback;
    try {
      return JSON.parse(String(value));
    } catch {
      return fallback;
    }
  };

  // Rebuilds a Sniffer report object from one row of a previously exported
  // Excel/ODS/CSV file. Mirrors flattenObject's `parent_child` key joining
  // and per-type serialization (arrays of primitives -> "; "-joined,
  // arrays of objects/tuples -> JSON string) so an exported report can be
  // re-imported without re-querying the providers.
  const reconstructReportFromFlatRow = (row: Record<string, any>): Record<string, any> => {
    const str = (v: any): string => (v === undefined || v === null ? '' : String(v));
    const splitList = (v: any): string[] => (str(v) ? str(v).split('; ') : []);

    return {
      queries: splitList(row['queries']),
      engine: str(row['engine']),
      competitors: safeJsonParse(row['competitors'], []),
      sources: {
        metadata: {
          all_sources: splitList(row['sources_metadata_all_sources']),
          used_sources: safeJsonParse(row['sources_metadata_used_sources'], []),
          number_of_sources: Number(row['sources_metadata_number_of_sources']) || 0,
          number_of_used_sources: Number(row['sources_metadata_number_of_used_sources']) || 0,
          used_source_with_markdown: safeJsonParse(row['sources_metadata_used_source_with_markdown'], []),
        },
        kpi: {
          used_domains: safeJsonParse(row['sources_kpi_used_domains'], []),
          all_domains: safeJsonParse(row['sources_kpi_all_domains'], []),
          asset_detected: str(row['sources_kpi_asset_detected']).toLowerCase() === 'true',
          assets_and_competitors_sorted: safeJsonParse(row['sources_kpi_assets_and_competitors_sorted'], []),
          grounding_cosine_similarities: safeJsonParse(row['sources_kpi_grounding_cosine_similarities'], []),
        },
      },
      llm_output: { text: str(row['llm_output_text']) },
    };
  };

  const handleImportReport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = event.target?.result as ArrayBuffer;
        const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });

        const merged = new Map<string, ReportResult>();

        for (const sheetName of workbook.SheetNames) {
          const sheetRows = XLSX.utils.sheet_to_json<Record<string, any>>(workbook.Sheets[sheetName]);

          sheetRows.forEach((row) => {
            const query = String(row['Query'] || '').trim();
            if (!query) return;
            const assets = String(row['Assets'] || '').trim();

            const engine = String(row['engine'] || '').toLowerCase();
            const field: 'geminiResponse' | 'openaiResponse' | null =
              engine === 'google' ? 'geminiResponse'
              : engine === 'openai' ? 'openaiResponse'
              : sheetName.toLowerCase().includes('gemini') ? 'geminiResponse'
              : sheetName.toLowerCase().includes('openai') ? 'openaiResponse'
              : null;
            if (!field) return;

            const key = `${query}||${assets}`;
            const existing: ReportResult = merged.get(key) || { query, assets, status: 'success' };
            existing[field] = reconstructReportFromFlatRow(row);
            merged.set(key, existing);
          });
        }

        if (merged.size === 0) {
          alert('No recognizable data found. Import a report exported from this app (the "Gemini"/"OpenAI" sheets, or an .ods/.csv with the same columns).');
          return;
        }

        const importedResults = Array.from(merged.values());
        setRows(importedResults.map(({ query, assets }) => ({ query, assets })));
        setResults(importedResults);
      } catch (error) {
        alert(`Error reading report file: ${error}`);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const generateBatchReports = async () => {
    if (rows.length === 0) {
      alert('Please upload a file first');
      return;
    }

    setLoading(true);
    setProgress({ current: 0, total: rows.length });
    const updatedResults: ReportResult[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const assetsList = row.assets.split(',').map(a => a.trim()).filter(Boolean);

      const resultRow: ReportResult = {
        ...row,
        status: 'success',
      };

      let hasError = false;

      try {
        // Call for each provider
        for (const provider of ['gemini', 'openai']) {
          try {
            const payload = {
              query: row.query,
              provider: provider,
              assets: assetsList,
            };

            const res = await fetch('/api/audit', {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(payload),
            });

            if (!res.ok) {
              throw new Error(`HTTP ${res.status}`);
            }

            const json = await res.json();

            if (json.success) {
              if (provider === 'gemini') {
                resultRow.geminiResponse = json.response;
              } else {
                resultRow.openaiResponse = json.response;
              }
            } else {
              hasError = true;
              resultRow.error = json.error || 'Unknown error';
            }
          } catch (providerError) {
            hasError = true;
            resultRow.error = String(providerError);
          }
        }

        resultRow.status = hasError ? 'error' : 'success';
        updatedResults.push(resultRow);
      } catch (error) {
        updatedResults.push({
          ...row,
          status: 'error',
          error: String(error),
        });
      }

      setProgress({ current: i + 1, total: rows.length });
      setResults([...updatedResults]);
    }

    setLoading(false);
  };

  const parseJsonResponse = (response: any): Record<string, any> => {
    if (typeof response === 'string') {
      try {
        return JSON.parse(response);
      } catch {
        return { 'Raw Response': response };
      }
    }
    return response || {};
  };

  const flattenObject = (obj: any, prefix: string = ''): Record<string, any> => {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(obj || {})) {
      const newKey = prefix ? `${prefix}_${key}` : key;

      if (value === null || value === undefined) {
        result[newKey] = '';
      } else if (typeof value === 'object' && !Array.isArray(value)) {
        Object.assign(result, flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        // Convert arrays to formatted string
        if (value.length === 0) {
          result[newKey] = '';
        } else if (typeof value[0] === 'object') {
          result[newKey] = JSON.stringify(value).substring(0, 32000);
        } else {
          result[newKey] = value.join('; ');
        }
      } else {
        result[newKey] = String(value).substring(0, 32000);
      }
    }

    return result;
  };

  const downloadResults = () => {
    if (results.length === 0) {
      alert('No results to download');
      return;
    }

    // Process Gemini results
    const geminiData = results
      .filter(r => r.geminiResponse)
      .map((result, idx) => {
        const parsed = parseJsonResponse(result.geminiResponse);
        const flattened = flattenObject(parsed);
        return {
          '#': idx + 1,
          'Query': result.query,
          'Assets': result.assets,
          ...flattened,
        };
      });

    // Process OpenAI results
    const openaiData = results
      .filter(r => r.openaiResponse)
      .map((result, idx) => {
        const parsed = parseJsonResponse(result.openaiResponse);
        const flattened = flattenObject(parsed);
        return {
          '#': idx + 1,
          'Query': result.query,
          'Assets': result.assets,
          ...flattened,
        };
      });

    // Get all column headers
    const geminiHeaders = geminiData.length > 0 ? Object.keys(geminiData[0]) : [];
    const openaiHeaders = openaiData.length > 0 ? Object.keys(openaiData[0]) : [];

    // Create worksheets
    const workbook = XLSX.utils.book_new();

    if (geminiData.length > 0) {
      const geminiSheet = XLSX.utils.json_to_sheet(geminiData);
      geminiSheet['!cols'] = geminiHeaders.map(() => ({ wch: 25 }));
      XLSX.utils.book_append_sheet(workbook, geminiSheet, 'Gemini');
    }

    if (openaiData.length > 0) {
      const openaiSheet = XLSX.utils.json_to_sheet(openaiData);
      openaiSheet['!cols'] = openaiHeaders.map(() => ({ wch: 25 }));
      XLSX.utils.book_append_sheet(workbook, openaiSheet, 'OpenAI');
    }

    XLSX.writeFile(workbook, `batch-reports-${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-6 w-full max-w-full">
      {/* Upload Section */}
      <div className="w-full rounded-[22px] border p-6 box-border" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel-alt)' }}>
        <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Upload Excel File</h2>

        <div
          className="rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition"
          style={{ borderColor: 'var(--primary)', backgroundColor: 'var(--primary-soft)' }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/vnd.oasis.opendocument.spreadsheet"
            onChange={handleFileUpload}
            className="hidden"
          />
          <div className="text-3xl mb-2">📁</div>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Click to upload or drag and drop
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Supports: Excel (.xlsx, .xls) • CSV • OpenDocument (.ods)
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            2 columns required: Query and Assets (comma-separated)
          </p>
        </div>
      </div>

      {/* Import Existing Report */}
      <div className="w-full rounded-[22px] border p-6 box-border" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel-alt)' }}>
        <h2 className="mb-1 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Import Existing Report</h2>
        <p className="mb-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Already ran this batch before? Import a previously exported report to view it here instead of re-running the queries.
        </p>

        <div
          className="rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition"
          style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel)' }}
          onClick={() => importFileInputRef.current?.click()}
        >
          <input
            ref={importFileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.ods,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,application/vnd.oasis.opendocument.spreadsheet"
            onChange={handleImportReport}
            className="hidden"
          />
          <div className="text-3xl mb-2">📂</div>
          <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
            Click to import a report
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Supports: Excel (.xlsx, .xls) • CSV • OpenDocument (.ods)
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
            Must have the same columns as the file produced by "Download Excel" below
          </p>
        </div>
      </div>

      {/* File Preview */}
      {rows.length > 0 && (
        <div className="w-full rounded-[22px] border p-6 box-border" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel-alt)' }}>
          <h2 className="mb-4 text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
            Preview ({rows.length} rows loaded)
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: `1px solid var(--stroke)` }}>
                  <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--primary-strong)' }}>Query</th>
                  <th className="text-left px-4 py-2 font-medium" style={{ color: 'var(--primary-strong)' }}>Assets</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 5).map((row, idx) => (
                  <tr key={idx} style={{ borderBottom: `1px solid var(--stroke)` }}>
                    <td className="px-4 py-2" style={{ color: 'var(--foreground)' }}>{row.query}</td>
                    <td className="px-4 py-2" style={{ color: 'var(--foreground)' }}>{row.assets}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.length > 5 && (
            <p className="mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
              Showing first 5 of {rows.length} rows
            </p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      {rows.length > 0 && (
        <div className="flex gap-3 w-full">
          <button
            onClick={generateBatchReports}
            disabled={loading}
            className="material-button-primary"
          >
            {loading ? `Processing... (${progress.current}/${progress.total})` : 'Generate Reports'}
          </button>
          <button
            onClick={() => {
              setRows([]);
              setResults([]);
              if (fileInputRef.current) fileInputRef.current.value = '';
              if (importFileInputRef.current) importFileInputRef.current.value = '';
            }}
            className="material-button-secondary"
          >
            Clear
          </button>
        </div>
      )}

      {/* Results Section - Dashboard */}
      {results.length > 0 && (
        <>
          <div className="w-full rounded-[22px] border p-6 box-border" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel-alt)' }}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>
                Processing Results
              </h2>
              <button
                onClick={downloadResults}
                className="material-button-primary text-sm"
              >
                📥 Download Excel
              </button>
            </div>

            <div className="w-full overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: `2px solid var(--primary)` }}>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--primary-strong)' }}>Query</th>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--primary-strong)' }}>Status</th>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--primary-strong)' }}>Gemini</th>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--primary-strong)' }}>OpenAI</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice(0, 10).map((result, idx) => (
                    <tr key={idx} style={{ borderBottom: `1px solid var(--stroke)` }}>
                      <td className="px-3 py-2 max-w-xs truncate" style={{ color: 'var(--foreground)' }}>
                        {result.query}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className="inline-flex px-2 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: result.status === 'success' ? '#ecfdf5' : result.status === 'error' ? '#fef3f2' : '#f3f4f6',
                            color: result.status === 'success' ? '#059669' : result.status === 'error' ? '#dc2626' : '#6b7280',
                          }}
                        >
                          {result.status}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        {result.geminiResponse ? '✓' : '-'}
                      </td>
                      <td className="px-3 py-2">
                        {result.openaiResponse ? '✓' : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {results.length > 10 && (
              <p className="mt-3 text-xs" style={{ color: 'var(--text-secondary)' }}>
                Showing first 10 of {results.length} results
              </p>
            )}
          </div>

          {/* Dashboard */}
          <GeoMonitoringDashboard results={results} />
        </>
      )}
    </div>
  );
}
