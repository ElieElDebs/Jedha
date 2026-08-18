import { NextResponse } from 'next/server';

/**
 * Single provider audit endpoint - isolates requests to prevent interference.
 * Expects: POST { query: string, provider: 'openai' | 'gemini' }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { query, provider } = body as { query: string; provider: string };

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return NextResponse.json({ success: false, error: 'Invalid payload: missing query' }, { status: 400 });
    }

    if (query.length > 4000) {
      return NextResponse.json({ success: false, error: 'Query too long' }, { status: 413 });
    }

    if (!provider || !['openai', 'gemini'].includes(provider.toLowerCase())) {
      return NextResponse.json({ success: false, error: 'Invalid provider' }, { status: 400 });
    }

    const sanitizedQuery = query.replace(/<\/?script[^>]*>/gi, '');
    const backendUrl = process.env.JEDHA_BACKEND_URL;
    const backendApiKey = process.env.JEDHA_BACKEND_API_KEY;

    if (!backendUrl) {
      return NextResponse.json({ success: false, error: 'Backend not configured' }, { status: 500 });
    }

    const path = provider.toLowerCase() === 'openai' ? '/report/openai/get/' : '/report/gemini/get/';
    const url = `${backendUrl.replace(/\/$/, '')}${path}?prompt=${encodeURIComponent(sanitizedQuery)}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

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
        return NextResponse.json({
          success: false,
          provider,
          error: `backend: ${text}`,
        }, { status: res.status });
      }

      const json = await res.json().catch(() => null);
      const data = json?.data ?? json;

      return NextResponse.json({
        success: true,
        provider,
        prompt: sanitizedQuery,
        response: typeof data === 'string' ? data : JSON.stringify(data),
        metadata: { raw: json },
      });
    } catch (err: any) {
      clearTimeout(timeout);
      const errorMsg = err.name === 'AbortError' ? 'timeout' : String(err?.message || err);
      return NextResponse.json({ success: false, provider, error: errorMsg }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ success: false, error: String(err?.message || err) }, { status: 500 });
  }
}
