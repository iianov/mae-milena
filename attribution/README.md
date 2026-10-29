# Referências de contatos — preparação

Estado em 29/10/2026: Worker implantado manualmente e teste sintético enviado pelo WhatsApp no iPhone. Coleta voltou a false. Integração da home preparada nesta branch, com data-enabled=false; sem importação para Google Ads. A conta nova é 424-178-5866. GTM e tags de anúncios preservados. A referência do teste não comprova atribuição a um anúncio real.

## Hospedagem separada

O site permanece no GitHub Pages. Um Cloudflare Worker em seu próprio endereço workers.dev receberá somente identificador do clique, UUID da tentativa e confirmação do consentimento aplicável. O banco D1 deve ficar na conta Cloudflare do responsável. Não é necessário transferir domínio ou DNS.

Não guardar GCLIDs em GitHub, código público, issues ou planilhas públicas. O endpoint só retorna uma referência aleatória; não existe rota pública de consulta, listagem, exportação ou atualização. Consulta inicial será pelo painel D1 autenticado da Cloudflare. Não há coleta de telefone, nome, conversa, situação afetiva ou informação religiosa. Origem/CORS não autenticam visitantes nem impedem requisições forjadas; o limitador reduz abuso, mas não identifica fraude de anúncios.

## Configuração necessária antes da integração

1. Criar D1 `milena-referencias` e executar `schema.sql` no console desse banco.
2. Criar o Worker usando `worker.mjs`, associar o D1 como `DB` e configurar o limitador como `REFERENCE_RATE_LIMITER` (10 solicitações/60 segundos por chave). Alternativamente, configurar o ID do D1 em `wrangler.jsonc` e implantar por Wrangler. O ID do banco já está preenchido. Implantar este arquivo mantém COLLECTION_ENABLED=false.
3. Manter `COLLECTION_ENABLED=false` até validar a implantação, a privacidade e o fluxo de consentimento. Não alterar para true simplesmente para passar um teste.
4. Configurar execução diária de `scheduled` para remover registros expirados. Os registros expiram em 90 dias e a limpeza diária remove os vencidos. Considerar separadamente os prazos de backups e registros do provedor.
5. Testar com dados sintéticos. Verificar persistência, limitação e acesso exclusivo do responsável ao D1.

## Integração de página ainda pendente

- Ativar codificação automática da conta de anúncios e capturar GCLID quando existir. Nunca inventar um identificador nem tratar visita orgânica como clique de anúncio. Verificar outros identificadores aplicáveis antes de cobrir tráfego que não contenha GCLID.
- Só enviar dados após o consentimento exigido e o aviso adequado; `consent:true` deve representar uma decisão real do visitante, não um valor fixo colocado pelo desenvolvedor.
- Criar/reutilizar UUID de tentativa no navegador; registrar referência antes de acrescentá-la ao texto do WhatsApp. Guardar o vínculo duravelmente no D1, não só no navegador.
- A referência é opaca e não contém o GCLID. Ela deverá aparecer no texto preenchido como `Ref. MM-...`. Se o cliente a apagar, a associação poderá ser perdida.
- Falha, indisponibilidade ou recusa de consentimento jamais devem impedir o atendimento: abrir o WhatsApp original sem referência. Não substituir o destino por um redirecionador que deixe de corresponder ao acionador atual de GTM.
- Só classificar mensagem recebida após vê-la no WhatsApp. Clique, referência criada e texto preenchido não provam envio de mensagem.
- O operador registra os marcos: mensagem recebida, orçamento enviado, interesse após orçamento e pagamento. Não inferir interesse somente pelo envio do orçamento.

## Google Ads ainda pendente

Validar elegibilidade da importação por GCLID para este serviço e as condições aplicáveis antes de aceitar declarações ou enviar dados. Conversões otimizadas para leads continuam desativadas. Esta preparação técnica não certifica conformidade nem resolve a classificação de categoria sensível.

Somente após validar origem e marcos reais, criar/testar a ação offline inicialmente sem uso em lances. Não lançar uma campanha otimizando para uma ação vazia/não alimentada. Configurar as tags da conta nova separadamente; o contêiner GTM existente pode ser mantido. Não usar o ID da conta (com hífens) como ID AW de conversão.

## Verificação local

`node --test attribution/worker.test.mjs`

Os testes cobrem as proteções antes de acessar o banco. A persistência em D1 e o fluxo móvel completo precisam ser verificados após implantação; não são comprovados por esses testes.

## Cliente da home preparado, ainda desligado

`assets/whatsapp-reference.js` retorna imediatamente quando `data-enabled` não é `true`. A home nesta branch o carrega com `false`. Não há captura, armazenamento ou aviso novo enquanto desligado.

Quando ativado, lê apenas GCLID da URL ou estado consentido da mesma aba por até 24h. O aviso opcional aparece no rodapé para autorizar ou recusar; quem não autoriza segue sem referência. UUID e GCLID só são guardados na sessão e enviados após autorização real. Não captura parâmetros de navegação adicionais. Links preservam destino wa.me, número, texto original e atributos. Não intercepta cliques nem modifica GTM/dataLayer. Uma resposta tardia após revogação não decora os links.

Limites: apenas home; páginas de serviços ainda não carregam o cliente. Quem clicar antes de a referência ficar pronta, não autorizar, remover o texto ou não tiver GCLID ficará sem atribuição por este mecanismo. Não há recuperação de mensagens pelo WhatsApp/API. Recusar retira referência dos próximos links, mas não apaga registro existente no D1. O aviso rege apenas esta nova referência; não é um gerenciador de consentimento para as tags antigas.

Antes de ativar: revisar o aviso e a política para refletir coleta real; testar o cliente no navegador; confirmar codificação automática e elegibilidade do método de importação; definir marcos e rotina privada para ligar referências às mensagens recebidas. Nenhum dado é enviado ao Google por este cliente.

Teste do cliente: `node --test attribution/client.test.mjs`.
