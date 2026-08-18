import { NextResponse } from 'next/server';
import type { AuditPayload, AuditResponse } from '../../../lib/types';

/**
 * Server-side audit proxy.
 * Calls the backend report endpoints for configured providers and aggregates results.
 * Expects server env vars in `.env.local`: `JEDHA_BACKEND_URL` and `JEDHA_BACKEND_API_KEY`.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const payload = body as AuditPayload;

    // Basic validation
    if (!payload || typeof payload.query !== 'string' || payload.query.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid payload: missing query' }, { status: 400 });
    }

    if (payload.query.length > 4000) {
      return NextResponse.json({ success: false, error: 'Query too long' }, { status: 413 });
    }

    // sanitize
    const query = payload.query.replace(/<\/?script[^>]*>/gi, '');

    const backendUrl = process.env.JEDHA_BACKEND_URL;
    const backendApiKey = process.env.JEDHA_BACKEND_API_KEY;
    if (!backendUrl) {
      return NextResponse.json({ success: false, error: 'Backend not configured' }, { status: 500 });
    }
    if (!backendApiKey) {
      // still allow calls if backend is public, but warn
      console.warn('JEDHA_BACKEND_API_KEY not set; requests may fail if backend requires API key');
    }

    const providers = (payload.providers && payload.providers.length > 0)
      ? payload.providers
      : ['openai', 'gemini'];

    // map provider aliases
    const normalized = providers.map((p) => {
      const lp = p.toLowerCase();
      if (lp === 'chatgpt') return 'openai';
      return lp;
    });

    const results: any[] = [];

    // For each requested provider call the corresponding backend GET route
    await Promise.all(normalized.map(async (prov) => {
      let path: string | null = null;
      if (prov === 'openai') path = '/report/openai/get/';
      if (prov === 'gemini') path = '/report/gemini/get/';
      if (!path) {
        results.push({ provider: prov, error: 'Unknown provider' });
        return;
      }

      const url = `${backendUrl.replace(/\/$/, '')}${path}?prompt=${encodeURIComponent(query)}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const res = await fetch(url, {
          method: 'GET',
          headers: {
            'content-type': 'application/json',
            ...(backendApiKey ? { 'X-API-KEY': backendApiKey } : {}),
          },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
          const text = await res.text().catch(() => 'backend error');
          results.push({ provider: prov, error: `backend: ${text}` });
          return;
        }

        const json = await res.json().catch(() => null);
        // backend returns {status, message, data}
        const data = json?.data ?? json;
        // store a lightweight serialized response and metadata
        results.push({ provider: prov, prompt: query, response: typeof data === 'string' ? data : JSON.stringify(data), metadata: { raw: json } });
      } catch (err: any) {
        clearTimeout(timeout);
        if (err.name === 'AbortError') {
          results.push({ provider: prov, error: 'timeout' });
        } else {
          results.push({ provider: prov, error: String(err?.message || err) });
        }
      }
    }));

    const report = {
      id: `rpt_${Date.now()}`,
      timestamp: new Date().toISOString(),
      results,
    };

    const auditResponse: AuditResponse = { success: true, report };
    return NextResponse.json(auditResponse);
  } catch (err: any) {
    return NextResponse.json({ success: false, error: String(err?.message || err) }, { status: 500 });
  }
}
