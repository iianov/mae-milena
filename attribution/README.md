# Referências de atendimento — 29/10/2026

Conta nova: 424-178-5866. Site no GitHub Pages; Worker e D1 na Cloudflare. Nenhuma campanha nova lançada e nenhuma importação para Google Ads ativada. Ações de contato qualificado e venda são secundárias. GTM e tags existentes preservados.

## Atualização sem caixa de autorização

Por solicitação do responsável, o cliente cria a referência automaticamente, sem interface de autorização. Não envia nem registra consentimento. A adequação da coleta sem consentimento permanece pendente; esta implementação não certifica base legal nem elegibilidade para importação no Google Ads.

**Implantação pendente na Cloudflare:** substituir o código do Worker por `worker.mjs` e publicar. O código anterior exigia `consent:true` e recusará o novo formato. Até publicar o Worker atualizado, tentativas novas ficam sem referência; o atendimento pelo WhatsApp continua funcionando. Não restaurar um consentimento fictício para contornar a validação. Não é necessário mudar o banco ou os bindings.

O site carrega `assets/whatsapp-reference.js?v=20261029-3`. A captura exige `data-enabled=true`, GCLID e marcador `mm_source=ads4241785866`, ou estado válido da mesma aba. Adicionar esse marcador somente ao sufixo de URL final da campanha nova. O marcador separa operacionalmente campanhas; não autentica nem comprova origem na conta. Sem GCLID não inventamos um identificador.

O cliente guarda UUID, GCLID e referência na sessão da aba por até 24h. Reutiliza UUID após falhas e referência pronta após recarregar. O serviço recebe somente UUID e GCLID e retorna referência aleatória de 96 bits. Quatro links preservam destino wa.me, número, saudação original e atributos. Não intercepta cliques, espera rede para abrir o WhatsApp ou modifica GTM/dataLayer. Falhas e cliques antes da resposta mantêm contato direto sem referência.

## Infraestrutura

Worker `milena-referencias`, endpoint `https://milena-referencias.ianov-igor.workers.dev/references`. D1 vinculado como `DB`; limitador `REFERENCE_RATE_LIMITER`, 10 solicitações/60 segundos. Variável manual `COLLECTION_ENABLED=true`. O arquivo Wrangler conserva false para evitar ativação acidental em outra implantação.

Tabela e índice em `schema.sql`. Registros expiram em 90 dias, com remoção diária pelo cron `17 3 * * *` UTC. Backups do provedor podem ter retenção adicional. IP usado apenas no limitador, sem gravação na tabela. Observabilidade desligada. Não há rota pública de leitura, consulta ou exportação. Acesso ao D1 pelo painel autenticado. Origem/CORS e limitador não impedem toda requisição forjada nem detectam fraude de anúncios.

Não guardar GCLIDs reais no repositório, issues, planilhas públicas ou logs. Não coletar nome, telefone, conversa ou situação afetiva neste serviço. Referência associável a clique/atendimento não equivale a dado anônimo.

## Medição ainda pendente

Referência criada ou botão clicado não comprovam mensagem enviada. O operador precisa confirmar mensagem recebida, orçamento, interesse após conhecer o orçamento e pagamento. O cliente pode apagar o código e perder a associação. Sem GCLID ou em páginas de serviço não instrumentadas também pode faltar referência. Não há API do WhatsApp, tabela de marcos ou exportador implementado.

Validar condições do método e preparar rotina privada de classificação antes de enviar resultados reais. Conversões otimizadas para leads permanecem desligadas. Não marcar consentimento como concedido se não coletado. Não importar identificadores sintéticos nem lançar campanha otimizando para ação vazia.

## Testes

Executar `node --test attribution/client.test.mjs attribution/worker.test.mjs`.

14 testes locais cobrem captura automática sem consentimento fictício, quatro links, reutilização, falhas, isolamento, validação de payload, banco, rate limit e limpeza. Não substituem validação do Worker implantado.

Testes móveis anteriores confirmaram referência no WhatsApp e vínculo D1 com identificadores TEST_ONLY, na versão antiga com autorização. Não comprovam a nova versão automática ou atribuição a clique real. `diagnostico/integracao.html` utiliza o novo cliente com identificador fictício e armazenamento separado, sem GTM. `diagnostico/referencia.html` também foi atualizado para o payload sem consentimento.
