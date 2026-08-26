// Same-origin proxy so the browser never talks to NVIDIA directly.
// NVIDIA's API returns no CORS preflight headers, so a browser fetch to it is
// blocked ("Failed to fetch"). This function adds the key server-side and
// streams the upstream SSE back to the app over the same origin.
export const config = { runtime: 'nodejs' };

function readBody(req: any): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (c: any) => (data += c));
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).end('Method Not Allowed');
    return;
  }

  try {
    let raw = req.body;
    if (!raw) raw = await readBody(req);
    if (typeof raw !== 'string') raw = JSON.stringify(raw);
    const { upstream, payload } = JSON.parse(raw) as { upstream?: string; payload?: Record<string, unknown> };

    if (typeof upstream !== 'string' || !payload) {
      res.status(400).end('missing upstream/payload');
      return;
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (upstream.includes('api.nvidia.com')) {
      const key = process.env.NVIDIA_API_KEY || process.env.VITE_API_KEY || '';
      if (key) headers['Authorization'] = `Bearer ${key}`;
    }

    const upstreamRes = await fetch(upstream, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    res.status(upstreamRes.status);
    const ct = upstreamRes.headers.get('content-type');
    if (ct) res.setHeader('content-type', ct);
    res.setHeader('cache-control', 'no-store');
    res.setHeader('access-control-allow-origin', '*');

    if (upstreamRes.body) {
      const reader = upstreamRes.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    }
    res.end();
  } catch (e: any) {
    res.status(502).end('upstream error: ' + (e?.message || String(e)));
  }
}
