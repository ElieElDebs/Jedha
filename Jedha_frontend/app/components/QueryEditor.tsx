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
      providers: providers,
    };
    onSubmit(payload);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Query</label>
        <textarea
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Enter the question or text to audit"
          className="material-input min-h-[150px] resize-y"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Patterns (comma separated)</label>
          <input
            value={patterns}
            onChange={(e) => setPatterns(e.target.value)}
            className="material-input"
            placeholder="e.g. safety, cost, accuracy"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">Providers</label>
          <div className="flex flex-wrap gap-2 rounded-2xl border border-[rgba(23,49,33,0.10)] bg-[var(--panel-alt)] p-2">
            {providerOptions.map((provider) => {
              const selected = providers.includes(provider);
              return (
                <button
                  key={provider}
                  type="button"
                  onClick={() => toggleProvider(provider)}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    selected
                      ? 'bg-[linear-gradient(135deg,#2f7d5e_0%,#7bbd9c_100%)] text-white shadow-sm'
                      : 'bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {provider}
                </button>
              );
            })}
          </div>
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
