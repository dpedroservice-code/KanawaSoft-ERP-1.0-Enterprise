# Relatório de auditoria F0 — Kanawa Soft ERP 1.0

**Data de preparação:** 13 de Novembro de 2026  
**Branch:** `docs/enterprise-module-matrix-2026-11-13`  
**PR:** [#28 — Matriz técnica Enterprise](https://github.com/dpedroservice-code/KanawaSoft-ERP-1.0-Enterprise/pull/28)  
**Estado:** relatório de trabalho; evidência estática parcial. Não representa certificação, auditoria completa ou aprovação para produção.

## 1. Âmbito e limites

Este documento regista apenas evidências verificadas no código versionado da branch indicada. Os resultados do script SQL `supabase/audits/20261113_f0_read_only_audit.sql`, a reconciliação do ledger de migrations e os testes cross-tenant ainda não foram fornecidos/executados nesta etapa.

**Não foram executadas alterações** no Supabase, migrations, dados, políticas RLS, Edge Functions, domínio, DNS ou produção.

## 2. Resumo executivo preliminar

| Área | Resultado observado | Estado F0 |
|---|---|---|
| IndexedDB | `app/app.js` declara 154 nomes em `DB_STORES`, não 146 | Evidência estática; confirmar stores efectivamente criadas na instalação |
| Inicialização IndexedDB | A versão local declarada é 10; no upgrade, cria apenas stores ausentes | Parcial; rever migrações históricas, dados antigos e consumidores |
| Chamadas Edge Functions | `app/cloud.js` referencia três slugs | Parcial; não prova inventário completo da pasta |
| Segredos privilegiados | Duas das três funções inspeccionadas usam `SUPABASE_SERVICE_ROLE_KEY` no servidor | Revisão estática inicial; validar secrets e deploy real sem expor valores |
| Autenticação | As funções inspeccionadas usam `auth.getUser(token)` | Parcial; requer testes negativos e revisão de todos os caminhos |
| Isolamento tenant | Foram observadas verificações de membership/empresa nas funções privilegiadas | Não prova RLS nem isolamento ponta-a-ponta |
| CORS | `company-integrations` define `Access-Control-Allow-Origin: *` | Ajuste de endurecimento recomendado; CORS não substitui autenticação/autorização |
| Supabase RLS / SECURITY DEFINER | Sem resultados SQL nesta etapa | Não verificado |
| Migrations / ledger / ledger fiscal | Sem reconciliação do ambiente isolado nesta etapa | Não verificado |
| Stores por módulo | Classificação preliminar pelo nome técnico abaixo | Parcial; validar consumidores e rotas reais |

## 3. Evidências estáticas — IndexedDB

Fonte: `app/app.js`, commit/blob `e13f6524c2e0dd4fd62d4b78144bb5703b11ef5f`.

- Linhas 189–192: array `DB_STORES` com **154 nomes únicos**.
- Linhas 199–200: base local `kanawa_erp_v15`, versão IndexedDB declarada `10`.
- Linhas 220–224: no evento `onupgradeneeded`, o código percorre `DB_STORES` e cria apenas stores que ainda não existem.
- Consequência: 154 é a quantidade declarada no código, não uma leitura do conteúdo de cada browser/instalação. Stores antigas adicionais podem persistir localmente, e a lista não demonstra que todas estejam em uso.

### Inventário preliminar por módulo M01–M19

A associação abaixo é uma classificação inicial pelo nome da store e pela área funcional provável. Não constitui prova de que cada store seja consumida exclusivamente por esse módulo; stores transversais podem servir a mais de uma área.

### M01 — Painel principal

`notificacoes`, `previsoesVendas`, `tendencias`, `forecasts`, `dashboardsCustom`

### M02 — Gestão comercial / CRM

`clientes`, `fornecedores`, `projetos`, `tarefas`, `leads`, `campanhas`, `eventos`, `orcamentos`, `contratos`, `aprovacoes`, `scoreLeads`, `campanhasMarketing`, `segmentacoes`, `ganttProjetos`, `timesheets`, `clientesPortal`, `contatosWhatsApp`, `feedbacks`, `tarefasProjetos`, `membrosProjetos`, `atividadesProjetos`, `eventosCalendar`

### M03 — PDV / Caixa

`vendas`, `pagamentos`, `devolucoes`, `promocoes`, `cupons`, `fidelidade`, `carrinhosSalvos`, `_sync_queue`, `sincronizacao`, `vendasConsignadas`

### M04 — Produtos e serviços

`produtos`, `categorias`, `unidades`, `servicos`, `tabelasPrecos`

### M05 — Stock e armazém

`estoque`, `movimentacoesEstoque`, `estoqueArmazens`, `transferencias`, `inventarios`, `lotes`, `rastreios`, `etiquetas`, `armazens`, `pecasEstoque`

### M06 — Compras e aprovisionamento

`compras`, `recebimentos`, `transportadoras`

### M07 — Facturação e documentos fiscais

`faturas`, `documentos`, `documentosFiscais`, `configuracoesFatura`, `assinaturasDigitais`

### M08 — Financeiro e contabilidade

`contasReceber`, `contasPagar`, `planoContas`, `budgets`, `conciliacoes`, `transacoesBancarias`, `ivas`, `irts`, `depreciacoes`

### M09 — Recursos humanos

`funcionarios`, `folhasPagamento`, `turnos`, `ferias`, `vagas`, `candidatos`, `desempenhoRH`, `beneficios`, `planosCarreira`, `onboarding`, `pontoDigital`, `rescisoes`, `departamentos`, `frequencias`, `feriasFuncionarios`, `pagamentosFuncionarios`, `quizzes`

### M10 — Produção / indústria

`producao`, `ordensProducao`, `mrp`, `boms`, `custosProducao`, `controleQualidade`, `planosProducao`, `centrosTrabalho`, `roteirosProducao`, `operacoesProducao`, `paradasProducao`, `subprodutosProducao`, `rastreabilidadeProducao`, `execucoesProducao`

### M11 — Serviços técnicos / manutenção

`ordensServico`, `manutencoes`, `ordensManutencao`, `garantias`, `checklistsInspecao`, `calendarioManutencoes`, `tecnicos`, `manutencaoEquipamentos`, `historicoOS`, `manutencoesAtivos`

### M12 — E-commerce

`ecommerce`, `ecommerceProdutos`, `ecommerceCarrinhos`, `ecommercePedidos`, `avaliacoes`, `pagamentosEcommerce`

### M13 — Logística e entregas

`frotas`, `gpsTracking`, `roteirizacao`, `abastecimentos`, `multas`, `motoristas`

### M14 — Relatórios e análise

`ddgHistorico`, `bingHistorico`

### M15 — Administração e segurança

`empresas`, `usuarios`, `auditoria`, `dispositivos`, `acessos`, `politicasSenha`, `tentativasLogin`, `sessoes`, `sms2FA`, `logsSeguranca`, `seguranca`, `gruposUsuarios`

### M16 — Centro de integrações

`mensagens`, `cursos`, `tickets`, `mensagensChat`, `mensagensWhatsApp`, `integracoesAGT`, `automacoes`, `audiobooks`, `templatesWhatsApp`

### M17 — Centro AGT / fiscal

`certificacoes`

### M18 — Administração SaaS

`ativos`, `modulosPersonalizados`, `migracoes`

### M19 — Configurações e transversal

`empresaConfig`, `config`, `backups`, `backupsAgendados`, `backupsNuvem`


## 4. Evidências estáticas — Edge Functions referenciadas pelo cliente

Fonte: `app/cloud.js`, blob `f489d5b8978baf4701c4194e48b1fb94bef4e2b4`.

Chamadas encontradas:
- Linha 705: `agt-saft-accounting-export`.
- Linhas 771 e 780: `agt-fiscal-config`.
- Linha 1294: `company-integrations`.

### 4.1 `agt-saft-accounting-export`

Fonte: `supabase/functions/agt-saft-accounting-export/index.ts`, blob `5b6adfc1336dd7d2af3fdb33e3b0c06d724361ed`.

- Linhas 30–41: usa `SUPABASE_URL` e chave pública no servidor; extrai Bearer token e valida utilizador por `auth.getUser(token)`.
- Linhas 43–49: recebe `companyId` e intervalo de datas do pedido e valida formato.
- Linhas 63–66: chama RPC `ks_accounting_saft_snapshot` com `p_company_id`; a autorização final depende também da segurança da RPC/RLS.
- Linhas 52–60 e 79–83: mantém estado de pré-certificação quando o número de validação é `0`; não afirma certificação AGT.

**Ponto pendente:** confirmar que a RPC valida membership, permissão e empresa do utilizador, e que não confia apenas no `companyId` recebido.

### 4.2 `agt-fiscal-config`

Fonte: `supabase/functions/agt-fiscal-config/index.ts`, blob `4b537e467e3985f8c7660a71164ab5e448ea5c91`.

- Linhas 59–73: lê `SUPABASE_SERVICE_ROLE_KEY` apenas no servidor, valida Bearer token com `auth.getUser(token)` e cria cliente administrativo.
- Linhas 79–84: consulta `ks_is_platform_admin` com o cliente do utilizador e exige membership activa para acesso tenant, salvo administrador da plataforma.
- Linhas 128–130: restringe `save_config` a `owner`/ `admin` da empresa ou administrador da plataforma.
- Linhas 154–158: bloqueia ambiente de produção quando faltam elementos de validação/certificação e chaves exigidas.
- Linhas 165–175: guarda credenciais cifradas com AES-GCM e mantém estado pendente quando os requisitos não estão completos.

**Pontos pendentes:** rever todas as acções e RPCs chamadas com privilégios elevados; confirmar segredo de cifragem e rotação no ambiente; testar memberships duplicadas/ambíguas e chamadas sem papel autorizado.

### 4.3 `company-integrations`

Fonte: `supabase/functions/company-integrations/index.ts`, blob `b2fb4ca538886b148f83187b7267fe58a98907bf`.

- Linhas 35–46: usa `SUPABASE_SERVICE_ROLE_KEY` no servidor, valida sessão e cria cliente administrativo.
- Linhas 52–64: exige membership activa e papéis permitidos para operações tenant; a acção de envio de chave exige `ks_is_platform_admin`.
- Linhas 116–129: cifra credenciais antes de persistir no cofre.
- Linhas 3–8: CORS está definido com origem `*`; recomenda-se restringir a lista de origens ao domínio e previews necessários.

**Pontos pendentes:** verificar cada acção individual, limites de frequência, escopos, expiração/revogação de chaves, autorização da RPC de plataforma e se a função está efectivamente publicada com a versão analisada.

## 5. Achados e classificação preliminar

| ID | Severidade preliminar | Achado | Evidência / acção |
|---|---|---|---|
| F0-CODE-001 | Média | Divergência na contagem documentada: 154 stores no código, contra a referência anterior de 146 | Confirmar inventário no browser e actualizar documentação após reconciliação |
| F0-CODE-002 | Média | `company-integrations` permite CORS de qualquer origem | Restringir origens permitidas; manter autenticação e autorização server-side |
| F0-CODE-003 | Alta — por validar | Exportação SAF-T recebe `companyId` do cliente e delega a autorização à RPC | Inspeccionar a RPC e testar utilizador de empresa A a solicitar empresa B |
| F0-CODE-004 | Alta — por validar | Duas funções usam service role | Revisão completa de cada acção, grants, membership e menor privilégio; confirmar que a chave nunca chega ao cliente |
| F0-PENDING-001 | Crítica — não classificada | RLS e isolamento cross-tenant não foram testados nesta etapa | Executar SQL read-only e testes com duas empresas de teste |
| F0-PENDING-002 | Alta — não classificada | Estado das migrations e ledger fiscal não foi reconciliado | Comparar migrations versionadas com ledger real e estrutura fiscal |
| F0-PENDING-003 | Média — não classificada | Stores efectivamente abertas e utilizadas em cada instalação não foram observadas | Teste controlado em browser e mapa store→consumidor→módulo |

> Severidade “por validar” indica risco que merece investigação; não significa vulnerabilidade confirmada. Os itens “não classificados” não devem ser tratados como conformes nem como falhas confirmadas.

## 6. Recolha pendente no Supabase isolado

Executar o script `supabase/audits/20261113_f0_read_only_audit.sql` no projecto isolado/staging e anexar resultados sem segredos nem dados pessoais.

- [ ] Tabelas expostas sem RLS e tabelas sem políticas adequadas.
- [ ] Policies completas: comando, roles, `USING` e `WITH CHECK`.
- [ ] Funções `SECURITY DEFINER`: owner, `search_path`, grants e validação de identidade/tenant.
- [ ] Grants em tabelas, views, sequences e funções.
- [ ] FKs e índices das chaves de tenant.
- [ ] Triggers e constraints de imutabilidade fiscal.
- [ ] Ledger real de migrations e reconciliação com `supabase/migrations/`.
- [ ] Existência e estrutura de `ks_fiscal_documents`, sequências e documentos correctivos.
- [ ] Testes cross-tenant positivos e negativos com duas empresas de teste.
- [ ] Advisors de segurança e desempenho.

## 7. Critérios para fechar F0

F0 só deve ser considerada concluída quando:
1. Os resultados SQL estiverem anexados e reconciliados com o código.
2. Todas as funções privilegiadas e RPCs tiverem revisão de autorização documentada.
3. O isolamento entre empresas tiver testes reproduzíveis.
4. As stores tiverem mapa confirmado por consumidores, rotas e módulo.
5. As divergências críticas/altas estiverem corrigidas em branch isolada e novamente testadas.
6. Não houver alterações em produção sem aprovação explícita.

## 8. Protecção do ambiente

Este relatório não autoriza execução de migrations, alterações de RLS, deploy de Edge Functions, alterações de dados, domínio, DNS ou produção. Qualquer correcção deve ter alteração isolada, revisão, testes e autorização própria.
