/* Referência opcional de origem. Não altera nem dispara tags de conversão. */
(() => {
  'use strict';
  if (document.currentScript?.dataset.enabled !== 'true') return;
  const endpoint = 'https://milena-referencias.ianov-igor.workers.dev/references';
  const testMode = document.currentScript?.dataset.testMode === 'true' && location.pathname === '/diagnostico/integracao.html';
  const source = 'ads4241785866';
  const params = new URL(location.href).searchParams;
  const key = testMode ? 'mm_reference_test_v1' : 'mm_reference_v1';
  const validClick = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,1024}$/.test(value);
  const validRef = value => typeof value === 'string' && /^MM-[A-F0-9]{24}$/.test(value);
  const validId = value => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
  let saved;
  try { saved = JSON.parse(sessionStorage.getItem(key)); } catch { /* Armazenamento opcional. */ }
  const incoming = testMode ? 'TEST_ONLY_INTEGRATION_NO_AD_CLICK' : params.get('gclid');
  const reusable = saved?.consent === true && validClick(saved.gclid) && validId(saved.request_id) &&
    saved.source === source &&
    Number.isFinite(saved.expires) && saved.expires > Date.now() && saved.expires <= Date.now() + 86400000 &&
    (!incoming || incoming === saved.gclid);
  // O marcador será incluído somente na URL da campanha nova. Não é autenticação.
  if (!testMode && params.get('mm_source') !== source && (incoming || !reusable || params.has('mm_source'))) return;
  const gclid = validClick(incoming) ? incoming : (!incoming && reusable ? saved.gclid : null);
  if (!gclid) return;
  let state = reusable ? saved : null;
  let allowed = Boolean(state);
  let pending;
  let generation = 0;
  const links = [...document.querySelectorAll('a[href]')].filter(link => {
    try { const url = new URL(link.href); return url.origin === 'https://wa.me' && url.pathname === '/5511971162445'; }
    catch { return false; }
  }).map(link => ({ link, original: link.getAttribute('href') }));
  const restore = () => links.forEach(({link, original}) => link.setAttribute('href', original));
  const decorate = reference => links.forEach(({link, original}) => {
    const url = new URL(original);
    url.searchParams.set('text', (url.searchParams.get('text') || '') + '\nRef. ' + reference);
    link.setAttribute('href', url.href);
  });
  const persist = () => { try { sessionStorage.setItem(key, JSON.stringify(state)); } catch { /* Continua em memória. */ } };
  const panel = document.createElement('section');
  panel.setAttribute('aria-label', 'Preferência de referência de atendimento');
  panel.style.cssText = 'margin:24px auto;padding:20px;max-width:900px;background:#17130c;color:#f5efe6;border:1px solid #c9a84c;font:16px/1.6 Lato,sans-serif;';
  const text = document.createElement('p');
  text.textContent = 'Podemos guardar o identificador do anúncio por até 90 dias e incluir uma referência na mensagem do WhatsApp para relacionar a origem ao atendimento? A conversa não é lida pelo site. Você pode continuar sem autorizar.';
  if (testMode) text.textContent = 'TESTE: autoriza guardar um identificador fictício no banco e uma referência nesta aba por até 24 horas? O registro no banco dura até 90 dias, salvo exclusão manual. Nenhum dado será enviado ao Google.';
  const policy = document.createElement('a');
  policy.href = '/politica-de-privacidade';
  policy.textContent = 'Política de Privacidade';
  policy.style.color = '#e8c97a';
  const actions = document.createElement('div');
  actions.style.cssText = 'display:flex;gap:12px;flex-wrap:wrap;margin-top:16px';
  const button = label => {
    const element = document.createElement('button');
    element.type = 'button'; element.textContent = label;
    element.style.cssText = 'padding:12px 16px;background:#f5efe6;color:#17130c;border:1px solid #c9a84c;font:inherit;cursor:pointer';
    actions.append(element); return element;
  };
  const accept = button('Autorizar referência');
  const refuse = button('Continuar sem referência');
  const note = document.createElement('p');
  note.setAttribute('role', 'status'); note.style.marginTop = '12px';
  panel.append(text, policy, actions, note);
  const hero = document.querySelector('.hero');
  if (hero) hero.after(panel);
  else document.querySelector('footer')?.prepend(panel);
  const render = () => {
    accept.textContent = allowed ? 'Tentar preparar referência' : 'Autorizar referência';
    accept.hidden = allowed && validRef(state?.reference);
    refuse.textContent = allowed ? 'Retirar autorização da referência' : 'Continuar sem referência';
  };
  const prepare = () => {
    if (!allowed || pending) return pending;
    if (validRef(state?.reference)) { decorate(state.reference); render(); return; }
    const version = generation;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    note.textContent = 'Preparando referência. O WhatsApp continua disponível.';
    pending = (async () => {
      try {
        const response = await fetch(endpoint, {
          method: 'POST', credentials: 'omit', cache: 'no-store', signal: controller.signal,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({request_id: state.request_id, gclid, consent: allowed})
        });
        if (!response.ok) throw new Error('unavailable');
        const result = await response.json();
        if (!validRef(result.reference)) throw new Error('invalid_reference');
        if (!allowed || version !== generation) return;
        state.reference = result.reference; persist(); decorate(result.reference);
        note.textContent = 'Referência pronta: ' + result.reference + '. Ela será incluída no texto do WhatsApp.';
      } catch {
        if (allowed && version === generation) note.textContent = 'Referência indisponível. Você pode falar pelo WhatsApp normalmente ou tentar novamente aqui.';
      } finally { clearTimeout(timeout); pending = null; render(); }
    })();
    return pending;
  };
  accept.addEventListener('click', () => {
    if (!allowed) {
      state = {consent: true, source, gclid, request_id: crypto.randomUUID(), expires: Date.now() + 86400000};
      allowed = true; generation++; persist();
    }
    render(); prepare();
  });
  refuse.addEventListener('click', () => {
    generation++; allowed = false; state = null; restore();
    try { sessionStorage.removeItem(key); } catch { /* Sem armazenamento. */ }
    note.textContent = 'Sem referência nos próximos cliques. A retirada não apaga registros já enviados; consulte a Política de Privacidade para solicitar exclusão.';
    render();
  });
  render();
  if (allowed) prepare();
  // Não intercepta cliques, não espera rede e não modifica dataLayer/GTM.
})();
