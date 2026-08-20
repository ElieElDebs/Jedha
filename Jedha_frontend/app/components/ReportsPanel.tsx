"use client";
import { useState, useRef } from 'react';
import * as XLSX from 'xlsx';

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
    <div className="space-y-6">
      {/* Upload Section */}
      <div className="rounded-[22px] border p-6" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel-alt)' }}>
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

      {/* File Preview */}
      {rows.length > 0 && (
        <div className="rounded-[22px] border p-6" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel-alt)' }}>
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
        <div className="flex gap-3">
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
            }}
            className="material-button-secondary"
          >
            Clear
          </button>
        </div>
      )}

      {/* Results Section */}
      {results.length > 0 && (
        <div className="rounded-[22px] border p-6" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel-alt)' }}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>Results</h2>
            <button
              onClick={downloadResults}
              className="material-button-primary text-sm"
            >
              📥 Download Excel
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
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
      )}
    </div>
  );
}
