import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';

const pages = ['amarracao-amorosa', 'adocamento-amoroso', 'uniao-de-casal', 'afastamento-de-rivais', 'sobre', 'depoimentos'];
const root = new URL('../', import.meta.url);
const code = readFileSync(new URL('assets/whatsapp-reference.js', root), 'utf8');
const tag = '<script src="/assets/whatsapp-reference.js?v=20261029-3" data-enabled="true" defer></script>\n';
const reference = 'MM-1234567890ABCDEF12345678';
const flush = () => new Promise(resolve => setImmediate(resolve));

function visit(page, {memory = new Map(), query = '?mm_source=ads4241785866&gclid=TEST_ONLY_SITELINK_CHECK', fail = false} = {}) {
  const html = readFileSync(new URL(page + '.html', root), 'utf8');
  const links = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>/g)].map(match => {
    const original = match[1].replaceAll('&amp;', '&');
    return {original, href: new URL(original, 'https://maemilenaamarracao.com.br/' + page).href,
      getAttribute() {return this.value ?? original;}, setAttribute(name, value) {assert.equal(name, 'href'); this.value = value;}};
  });
  const requests = [];
  vm.runInNewContext(code, {
    document: {currentScript: {dataset: {enabled: 'true'}}, querySelectorAll: () => links},
    location: {pathname: '/' + page, href: 'https://maemilenaamarracao.com.br/' + page + query},
    sessionStorage: {getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value)},
    URL, crypto: webcrypto, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {requests.push(JSON.parse(options.body)); return {ok: !fail, json: async () => ({reference})};}
  });
  return {links, requests, memory};
}

for (const page of pages) {
  test(page + ': only the shared capture script is added', () => {
    const html = readFileSync(new URL(page + '.html', root), 'utf8');
    const original = execFileSync('git', ['show', '537acd92af6d7050b17b50c3b8dc9327a008d5fa:' + page + '.html'], {cwd: root, encoding: 'utf8'});
    assert.equal(html.split(tag).length, 2);
    assert.equal(html.replace(tag, ''), original);
  });
  test(page + ': direct ad visit decorates every WhatsApp link and preserves other destinations', async () => {
    const s = visit(page); await flush();
    assert.equal(s.requests.length, 1);
    assert.equal(s.requests[0].gclid, 'TEST_ONLY_SITELINK_CHECK');
    assert.deepEqual(Object.keys(s.requests[0]).sort(), ['gclid', 'request_id']);
    let count = 0;
    for (const link of s.links) {
      const original = new URL(link.href);
      if (original.origin === 'https://wa.me' && original.pathname === '/5511971162445') {
        count++;
        const actual = new URL(link.getAttribute());
        assert.equal(actual.searchParams.get('text'), original.searchParams.get('text') + '\nRef. ' + reference);
        actual.searchParams.set('text', original.searchParams.get('text'));
        assert.equal(actual.origin + actual.pathname + actual.hash, original.origin + original.pathname + original.hash);
        assert.deepEqual([...actual.searchParams], [...original.searchParams]);
      } else assert.equal(link.getAttribute(), link.original);
    }
    assert(count >= 3);
  });
  test(page + ': organic and failed visits keep all original links', async () => {
    for (const options of [{query: ''}, {fail: true}, {query: '?mm_source=old_account&gclid=TEST_ONLY_OLD_ACCOUNT'}]) {
      const s = visit(page, options); await flush();
      assert(s.links.every(link => link.getAttribute() === link.original));
      if (!options.fail) assert.equal(s.requests.length, 0);
    }
  });
}

test('navigation from Home through all sitelinks and back reuses one GCLID and reference', async () => {
  const first = visit('index'); await flush();
  for (const page of [...pages, 'index']) {
    const s = visit(page, {memory: first.memory, query: ''}); await flush();
    assert.equal(s.requests.length, 0);
    const whatsapp = s.links.filter(link => link.href.startsWith('https://wa.me/5511971162445'));
    assert(whatsapp.length > 0);
    assert(whatsapp.every(link => new URL(link.getAttribute()).searchParams.get('text').endsWith('\nRef. ' + reference)));
  }
});
