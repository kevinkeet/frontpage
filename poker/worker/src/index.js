/**
 * Hold'em Coach API worker.
 *
 * Keeps the shared Anthropic key on the server. The app sends the table
 * password with every request; the worker checks it and forwards the
 * request to the Claude API. Nothing is stored.
 *
 *   POST /auth          {password}            -> 204 or 401
 *   POST /v1/messages   Messages API body     -> Claude's JSON response
 *
 * Required secrets: ANTHROPIC_API_KEY, SITE_PASSWORD.
 */
const ALLOWED_MODELS = new Set(['claude-opus-5', 'claude-sonnet-5', 'claude-haiku-4-5']);
const MAX_TOKENS_CAP = 2000;
const WINDOW_MS = 60_000, MAX_PER_WINDOW = 30;   // per-IP requests per minute (per isolate, best effort)
const hits = new Map();

function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Poker-Pass, anthropic-beta',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
function json(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}
function timingSafeEqual(a, b) {
  const enc = new TextEncoder();
  const x = enc.encode(a), y = enc.encode(b);
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}
function rateLimited(req) {
  const ip = req.headers.get('CF-Connecting-IP') || 'unknown';
  const now = Date.now();
  const rec = hits.get(ip) || { start: now, n: 0 };
  if (now - rec.start > WINDOW_MS) { rec.start = now; rec.n = 0; }
  rec.n++;
  hits.set(ip, rec);
  return rec.n > MAX_PER_WINDOW;
}

export default {
  async fetch(req, env) {
    const h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    if (req.method !== 'POST') return json({ error: 'POST only' }, 405, h);
    if (h['Access-Control-Allow-Origin'] === 'null') return json({ error: 'origin not allowed' }, 403, h);
    if (!env.SITE_PASSWORD || !env.ANTHROPIC_API_KEY) return json({ error: 'worker secrets not set' }, 500, h);

    const url = new URL(req.url);
    if (url.pathname === '/auth') {
      let body = {};
      try { body = await req.json(); } catch (e) {}
      if (typeof body.password === 'string' && timingSafeEqual(body.password, env.SITE_PASSWORD)) return new Response(null, { status: 204, headers: h });
      return json({ error: 'wrong password' }, 401, h);
    }

    if (url.pathname === '/v1/messages') {
      const pass = req.headers.get('X-Poker-Pass') || '';
      if (!timingSafeEqual(pass, env.SITE_PASSWORD)) return json({ error: { message: 'wrong table password' } }, 401, h);
      if (rateLimited(req)) return json({ error: { message: 'too many requests, slow down' } }, 429, h);
      let body;
      try { body = await req.json(); } catch (e) { return json({ error: { message: 'bad JSON' } }, 400, h); }
      if (!ALLOWED_MODELS.has(body.model)) body.model = 'claude-opus-5';
      body.max_tokens = Math.min(Number(body.max_tokens) || 1200, MAX_TOKENS_CAP);
      body.stream = false;
      const upstream = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          ...(req.headers.get('anthropic-beta') ? { 'anthropic-beta': req.headers.get('anthropic-beta') } : {}),
        },
        body: JSON.stringify(body),
      });
      const text = await upstream.text();
      return new Response(text, { status: upstream.status, headers: { 'Content-Type': 'application/json', ...h } });
    }
    return json({ error: 'not found' }, 404, h);
  },
};
