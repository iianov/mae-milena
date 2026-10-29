// Serviço separado do GitHub Pages. Não envia dados ao Google ou ao WhatsApp.
const ORIGINS = new Set(['https://maemilenaamarracao.com.br', 'https://www.maemilenaamarracao.com.br']);
const TTL = 90 * 24 * 60 * 60;

function reply(status, body, origin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', Vary: 'Origin' };
  if (ORIGINS.has(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return new Response(JSON.stringify(body), { status, headers });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const path = new URL(request.url).pathname;
    if (path === '/health' && request.method === 'GET') return reply(200, { ok: true }, origin);
    if (path !== '/references') return reply(404, { error: 'not_found' }, origin);
    if (!ORIGINS.has(origin)) return reply(403, { error: 'origin_not_allowed' }, origin);
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: {
        'Access-Control-Allow-Origin': origin,
        'Cache-Control': 'no-store', Vary: 'Origin',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      } });
    }
    if (request.method !== 'POST') return reply(405, { error: 'method_not_allowed' }, origin);
    // Falha fechada: a coleta depende da configuração explícita do responsável.
    if (env.COLLECTION_ENABLED !== 'true' || !env.DB || !env.REFERENCE_RATE_LIMITER) {
      return reply(503, { error: 'collection_not_configured' }, origin);
    }
    if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return reply(415, { error: 'json_required' }, origin);
    const ip = request.headers.get('CF-Connecting-IP');
    if (!ip) return reply(503, { error: 'edge_required' }, origin);
    try {
      // O IP é usado no limitador da Cloudflare, nunca gravado no banco de contatos.
      const limit = await env.REFERENCE_RATE_LIMITER.limit({ key: ip });
      if (!limit.success) return reply(429, { error: 'rate_limited' }, origin);
      const reader = request.body?.getReader();
      if (!reader) return reply(400, { error: 'invalid_body' }, origin);
      const chunks = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2048) { await reader.cancel(); return reply(413, { error: 'body_too_large' }, origin); }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
      let data;
      try { data = JSON.parse(new TextDecoder().decode(bytes)); }
      catch { return reply(400, { error: 'invalid_json' }, origin); }
      if (!data || typeof data !== 'object' || Array.isArray(data) ||
        Object.keys(data).some(key => !['request_id', 'gclid'].includes(key)) ||
        typeof data.request_id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(data.request_id) ||
        typeof data.gclid !== 'string' || !/^[A-Za-z0-9_-]{1,1024}$/.test(data.gclid)) {
        return reply(400, { error: 'invalid_fields' }, origin);
      }
      const now = Math.floor(Date.now() / 1000);
      const existing = await env.DB.prepare('SELECT reference, gclid, expires_at FROM ad_references WHERE request_id = ?').bind(data.request_id).first();
      if (existing) {
        if (existing.gclid !== data.gclid || existing.expires_at <= now) return reply(409, { error: 'request_conflict' }, origin);
        return reply(200, { reference: existing.reference }, origin);
      }
      const reference = 'MM-' + crypto.randomUUID().replaceAll('-', '').slice(0, 24).toUpperCase();
      await env.DB.prepare('INSERT INTO ad_references (request_id, reference, gclid, created_at, expires_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(request_id) DO NOTHING')
        .bind(data.request_id, reference, data.gclid, now, now + TTL).run();
      // Leia após inserir para devolver a mesma referência em requisições concorrentes.
      const saved = await env.DB.prepare('SELECT reference, gclid FROM ad_references WHERE request_id = ?').bind(data.request_id).first();
      if (!saved || saved.gclid !== data.gclid) return reply(409, { error: 'request_conflict' }, origin);
      return reply(200, { reference: saved.reference }, origin);
    } catch {
      // Nunca incluir identificadores, consultas SQL ou corpo da requisição nos logs/respostas.
      return reply(503, { error: 'temporarily_unavailable' }, origin);
    }
  },
  async scheduled(_event, env) {
    if (env.DB) await env.DB.prepare('DELETE FROM ad_references WHERE expires_at <= ?').bind(Math.floor(Date.now() / 1000)).run();
  },
};
