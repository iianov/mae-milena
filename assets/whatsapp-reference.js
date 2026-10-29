/* Referência de origem. Não altera nem dispara tags de conversão. */
(() => {
  'use strict';
  if (document.currentScript?.dataset.enabled !== 'true') return;
  const endpoint = 'https://milena-referencias.ianov-igor.workers.dev/references';
  const testMode = document.currentScript?.dataset.testMode === 'true' && location.pathname === '/diagnostico/integracao.html';
  const source = 'ads4241785866';
  const params = new URL(location.href).searchParams;
  const key = testMode ? 'mm_reference_test_v2' : 'mm_reference_v2';
  const validClick = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,1024}$/.test(value);
  const validRef = value => typeof value === 'string' && /^MM-[A-F0-9]{24}$/.test(value);
  const validId = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(key)); } catch { /* Armazenamento opcional. */ }
  const incoming = testMode ? 'TEST_ONLY_INTEGRATION_NO_AD_CLICK' : params.get('gclid');
  const reusable = validClick(saved?.gclid) && validId(saved.request_id) &&
    saved.source === source &&
    Number.isFinite(saved.expires) && saved.expires > Date.now() && saved.expires <= Date.now() + 86400000 &&
    (!incoming || incoming === saved.gclid);
  // O marcador será incluído somente na URL da campanha nova. Não é autenticação.
  if (!testMode && params.get('mm_source') !== source && (incoming || !reusable || params.has('mm_source'))) return;
  const gclid = validClick(incoming) ? incoming : (!incoming && reusable ? saved.gclid : null);
  if (!gclid) return;
  const state = reusable ? saved : {source, gclid, request_id: crypto.randomUUID(), expires: Date.now() + 86400000};
  const links = [...document.querySelectorAll('a[href]')].filter(link => {
    try { const url = new URL(link.href); return url.origin === 'https://wa.me' && url.pathname === '/5511971162445'; }
    catch { return false; }
  }).map(link => ({ link, original: link.getAttribute('href') }));
  const decorate = reference => links.forEach(({link, original}) => {
    const url = new URL(original);
    url.searchParams.set('text', (url.searchParams.get('text') || '') + '\nRef. ' + reference);
    link.setAttribute('href', url.href);
  });
  const persist = () => { try { sessionStorage.setItem(key, JSON.stringify(state)); } catch { /* Continua em memória. */ } };
  // Guarda a tentativa antes da rede para reutilizar o UUID após recarregar.
  persist();
  if (validRef(state.reference)) { decorate(state.reference); return; }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  (async () => {
    try {
      const response = await fetch(endpoint, {
        method: 'POST', credentials: 'omit', cache: 'no-store', signal: controller.signal,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({request_id: state.request_id, gclid})
      });
      if (!response.ok) return;
      const result = await response.json();
      if (!validRef(result.reference)) return;
      state.reference = result.reference; persist(); decorate(result.reference);
    } catch { /* Falha de medição mantém os links originais disponíveis. */ }
    finally { clearTimeout(timeout); }
  })();
  // Não cria interface, intercepta cliques, espera rede ou modifica dataLayer/GTM.
})();
