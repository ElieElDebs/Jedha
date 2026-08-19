"use client";
import { useState } from 'react';
import type { AuditPayload } from '../../lib/types';

type Props = {
  onSubmit: (payload: AuditPayload) => void;
};

/**
 * Client-side query editor. Collects the audit query and patterns.
 */
const providerOptions = ['chatgpt', 'gemini'];

export default function QueryEditor({ onSubmit }: Props) {
  const [query, setQuery] = useState('');
  const [patterns, setPatterns] = useState('');
  const [assets, setAssets] = useState('');
  const [providers, setProviders] = useState<string[]>(['chatgpt', 'gemini']);

  function toggleProvider(provider: string) {
    setProviders((current) => {
      if (current.includes(provider)) {
        return current.filter((item) => item !== provider);
      }
      return [...current, provider];
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: AuditPayload = {
      query: query.trim(),
      patterns: patterns
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
      assets: assets
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean),
      providers: providers,
    };
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Query</label>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter the question or text to audit"
          className="material-input min-h-[150px] resize-y"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Patterns (comma separated)</label>
          <input
            value={patterns}
            onChange={(e) => setPatterns(e.target.value)}
            className="material-input"
            placeholder="e.g. safety, cost, accuracy"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Assets to detect (comma separated)</label>
          <input
            value={assets}
            onChange={(e) => setAssets(e.target.value)}
            className="material-input"
            placeholder="e.g. API keys, tokens, credentials"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium" style={{ color: 'var(--foreground)' }}>Providers</label>
        <div className="flex flex-wrap gap-2 rounded-2xl border p-2" style={{ borderColor: 'var(--stroke)', backgroundColor: 'var(--panel-alt)' }}>
          {providerOptions.map((provider) => {
            const selected = providers.includes(provider);
            return (
              <button
                key={provider}
                type="button"
                onClick={() => toggleProvider(provider)}
                className="rounded-full px-3 py-1.5 text-sm font-medium transition"
                style={selected ? {
                  backgroundColor: 'var(--primary)',
                  color: 'white',
                  boxShadow: '0 2px 8px rgba(168, 213, 186, 0.2)'
                } : {
                  backgroundColor: 'white',
                  color: 'var(--foreground)',
                  border: '1px solid var(--stroke)'
                }}
                onMouseEnter={(e) => {
                  if (!selected) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'var(--surface-soft)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!selected) {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'white';
                  }
                }}
              >
                {provider}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button type="submit" className="material-button-primary">
          Run Audit
        </button>
        <button
          type="button"
          onClick={() => {
            setQuery('');
            setPatterns('');
            setAssets('');
            setProviders(['chatgpt', 'gemini']);
          }}
          className="material-button-secondary"
        >
          Reset
        </button>
      </div>
    </form>
  );
}
