import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const clientCode = readFileSync(new URL('../assets/whatsapp-reference.js', import.meta.url), 'utf8');
const ref = 'MM-1234567890ABCDEF12345678';
function setup({enabled = true, gclid = 'real_click_example', fail = false, delayed = false, testMode = false, pathname = '/', source = 'ads4241785866'} = {}) {
  const nodes = [];
  const make = () => {
    const node = {children: [], dataset: {}, style: {}, attributes: {}, hidden: false,
      append(...items) { this.children.push(...items); }, prepend(item) { this.children.unshift(item); },
      setAttribute(key, value) { this.attributes[key] = value; }, getAttribute(key) { return this.attributes[key]; },
      addEventListener(event, handler) { this[event] = handler; }};
    nodes.push(node); return node;
  };
  const links = Array.from({length: 4}, () => {
    const link = make(); link.href = 'https://wa.me/5511971162445?text=Ol%C3%A1';
    link.attributes.href = link.href; return link;
  });
  const footer = make();
  const requests = []; const memory = new Map(); let release;
  const context = {document: {currentScript: {dataset: {enabled: String(enabled), testMode: String(testMode)}},
    querySelectorAll: () => links, querySelector: selector => selector === 'footer' ? footer : null, createElement: make},
    location: {pathname, href: 'https://maemilenaamarracao.com.br' + pathname + '?mm_source=' + source + (gclid ? '&gclid=' + gclid : '')},
    sessionStorage: {getItem: key => memory.get(key) || null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key)},
    crypto: globalThis.crypto, URL, AbortController, setTimeout, clearTimeout,
    fetch: async (url, options) => {
      requests.push({url, data: JSON.parse(options.body)});
      if (delayed) await new Promise(resolve => { release = resolve; });
      return {ok: !fail, json: async () => ({reference: ref})};
    }};
  vm.runInNewContext(clientCode, context);
  return {links, nodes, requests, memory, footer, release: () => release?.(),
    buttons: nodes.filter(node => node.type === 'button')};
}
const flush = () => new Promise(resolve => setImmediate(resolve));
test('disabled client does nothing even with GCLID', () => {
  const s = setup({enabled: false}); assert.equal(s.requests.length, 0); assert.equal(s.buttons.length, 0); assert.equal(s.memory.size, 0);
});
test('organic visit does not create an attribution reference', () => {
  const s = setup({gclid: ''}); assert.equal(s.buttons.length, 0); assert.equal(s.requests.length, 0);
});
test('requires explicit authorization and leaves original links on refusal', () => {
  const s = setup(); assert.equal(s.requests.length, 0); assert.equal(s.memory.size, 0);
  s.buttons[1].click(); assert.equal(s.requests.length, 0);
  assert(s.links.every(link => !link.getAttribute('href').includes('Ref.')));
});
test('one authorized request decorates all four links; original text and target survive', async () => {
  const s = setup(); s.buttons[0].click(); s.buttons[0].click(); await flush();
  assert.equal(s.requests.length, 1); assert.equal(s.requests[0].data.consent, true);
  assert.equal(s.requests[0].data.gclid, 'real_click_example');
  for (const link of s.links) {
    const url = new URL(link.getAttribute('href')); assert.equal(url.origin, 'https://wa.me');
    assert.equal(url.pathname, '/5511971162445'); assert.equal(url.searchParams.get('text'), 'Olá\nRef. ' + ref);
  }
  s.buttons[1].click(); assert.equal(s.memory.size, 0);
  assert(s.links.every(link => link.getAttribute('href') === link.href));
});
test('failed request keeps contact available; retry reuses UUID', async () => {
  const s = setup({fail: true}); s.buttons[0].click(); await flush(); s.buttons[0].click(); await flush();
  assert.equal(s.requests[0].data.request_id, s.requests[1].data.request_id);
  assert(s.links.every(link => link.getAttribute('href') === link.href));
});
test('response after withdrawal cannot add a reference or restore storage', async () => {
  const s = setup({delayed: true}); s.buttons[0].click(); s.buttons[1].click(); s.release(); await flush();
  assert.equal(s.memory.size, 0); assert(s.links.every(link => link.getAttribute('href') === link.href));
});
test('diagnostic mode ignores real URL identifiers and uses separate storage', async () => {
  const s = setup({testMode: true, pathname: '/diagnostico/integracao.html'});
  s.buttons[0].click(); await flush();
  assert.equal(s.requests[0].data.gclid, 'TEST_ONLY_INTEGRATION_NO_AD_CLICK');
  assert.equal(s.memory.has('mm_reference_v1'), false);
  assert.equal(s.memory.has('mm_reference_test_v1'), true);
});
test('untagged or other-account ad clicks do not start the new capture', () => {
  for (const source of ['', 'old_account']) {
    const s = setup({source}); assert.equal(s.buttons.length, 0); assert.equal(s.memory.size, 0); assert.equal(s.requests.length, 0);
  }
});
