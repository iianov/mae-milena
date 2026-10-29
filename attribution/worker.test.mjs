import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from './worker.mjs';

const origin = 'https://maemilenaamarracao.com.br';
function environment() {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('./schema.sql', import.meta.url), 'utf8'));
  return {
    sqlite, COLLECTION_ENABLED: 'true',
    REFERENCE_RATE_LIMITER: { limit: async () => ({ success: true }) },
    DB: { prepare(sql) { return { bind(...args) { return {
      first: async () => sqlite.prepare(sql).get(...args),
      run: async () => sqlite.prepare(sql).run(...args),
    }; } }; } },
  };
}
function request(data = {}, headers = {}) {
  return new Request('https://example.workers.dev/references', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...headers },
    body: JSON.stringify({ request_id: '11111111-1111-4111-8111-111111111111', gclid: 'TEST_ONLY_123', ...data }),
  });
}

test('falha fechada e preflight sem corpo', async () => {
  assert.equal((await worker.fetch(request(), {})).status, 503);
  const response = await worker.fetch(new Request('https://example.workers.dev/references', { method: 'OPTIONS', headers: { Origin: origin } }), {});
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
});
test('não permite ler registros nem requisições de outra origem', async () => {
  const env = environment();
  assert.equal((await worker.fetch(request({}, { Origin: 'https://example.com' }), env)).status, 403);
  assert.equal((await worker.fetch(new Request('https://example.workers.dev/references', { headers: { Origin: origin } }), env)).status, 405);
  assert.equal(env.sqlite.prepare('SELECT count(*) AS n FROM ad_references').get().n, 0);
});
test('não aceita texto do atendimento, declaração de consentimento não coletado ou corpo excessivo', async () => {
  const env = environment();
  for (const data of [{ message: 'private' }, { consent: false }, { consent: true }, { gclid: "x'; DROP TABLE ad_references;--" }]) {
    assert.equal((await worker.fetch(request(data), env)).status, 400);
  }
  assert.equal((await worker.fetch(request({ gclid: 'X'.repeat(3000) }), env)).status, 413);
  assert.equal(env.sqlite.prepare('SELECT count(*) AS n FROM ad_references').get().n, 0);
});
test('mesma tentativa retorna referência persistente sem expor o GCLID', async () => {
  const env = environment();
  const first = await worker.fetch(request(), env);
  const payload = await first.json();
  assert.match(payload.reference, /^MM-[A-F0-9]{24}$/);
  assert.deepEqual(Object.keys(payload), ['reference']);
  assert.deepEqual(await (await worker.fetch(request(), env)).json(), payload);
  const row = env.sqlite.prepare('SELECT * FROM ad_references').get();
  assert.equal(row.gclid, 'TEST_ONLY_123');
  assert.equal(row.expires_at - row.created_at, 90 * 86400);
  assert.equal((await worker.fetch(request({ gclid: 'OTHER_CLICK' }), env)).status, 409);
});
test('limitação e erro de banco não expõem dados', async () => {
  const env = environment();
  env.REFERENCE_RATE_LIMITER.limit = async () => ({ success: false });
  assert.equal((await worker.fetch(request(), env)).status, 429);
  env.REFERENCE_RATE_LIMITER.limit = async () => ({ success: true });
  env.DB.prepare = () => { throw new Error('private_database_content'); };
  const response = await worker.fetch(request(), env);
  assert.equal(response.status, 503);
  assert.equal(await response.text(), '{"error":"temporarily_unavailable"}');
});
test('limpeza remove somente registros expirados', async () => {
  const env = environment();
  await worker.fetch(request(), env);
  env.sqlite.prepare('INSERT INTO ad_references VALUES (?, ?, ?, ?, ?)').run('old', 'MM-OLD', 'OLD', 0, 1);
  await worker.scheduled({}, env);
  assert.equal(env.sqlite.prepare('SELECT count(*) AS n FROM ad_references').get().n, 1);
});
