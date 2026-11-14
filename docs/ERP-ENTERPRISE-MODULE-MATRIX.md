# Matriz técnica Enterprise — Kanawa Soft ERP 1.0

**Data:** 13 de Novembro de 2026  
**Repositório:** `dpedroservice-code/KanawaSoft-ERP-1.0-Enterprise`  
**Âmbito:** matriz funcional, de dados, permissões, dependências e validação.  
**Estado:** documento de planeamento e auditoria; não altera aplicação, esquema Supabase, dados, domínio ou produção.

## 1. Regras de leitura do estado

- **Base existente:** há ecrã, fluxo, tabela/store, RPC ou documentação identificável. Não significa que todo o ciclo esteja validado.
- **Parcial / validar:** existem componentes, mas faltam passos, integração, validação ponta-a-ponta, ou confirmação em ambiente real.
- **Planeado:** requisito novo ou expansão que ainda precisa de implementação e testes.
- **Bloqueado por validação externa:** depende de credenciais, homologação, API de terceiro, enquadramento legal ou aprovação oficial.
- Um módulo só pode ser considerado **concluído** depois de validar interface, regras de negócio, persistência cloud, RLS/isolamento por empresa, permissões no servidor, auditoria, testes automatizados e teste funcional no navegador.
- Não criar stores IndexedDB ou tabelas Supabase duplicadas. Reutilizar o catálogo existente e `ks_records` quando esse for o contrato adequado; usar tabelas especializadas já existentes para operações que exigem integridade transaccional.
- Não aplicar migrations desta matriz automaticamente. Cada alteração de esquema exige revisão, teste isolado e aprovação própria.

## 2. Matriz funcional de módulos e submódulos

| ID | Módulo / área | Submódulos e funcionalidades de referência | Dados / integração a reutilizar ou validar | Estado observado |
|---|---|---|---|---|
| M01 | Painel principal | Resumo; vendas; compras; stock ao custo; potencial de venda; lucro realizado; margem estimada; contas a pagar/receber; comparativos temporais; previsão de caixa 7/15/30 dias; rankings de produtos, clientes e vendedores; alertas | Vendas, produtos, movimentos de stock, compras, contas a pagar/receber, caixa, colaboradores; confirmar agregações cloud e filtros de período/empresa | Parcial — dashboard e relatórios existem; comparativos, previsão e rankings exigem validação |
| M02 | Gestão comercial / CRM | Vendas; orçamentos; propostas; encomendas; clientes e contactos; fornecedores; leads; pipeline; campanhas; contratos; avenças; descontos; crédito e limites; cobrança; bloqueio por atraso | `vendas`, `orcamentos`, `clientes`, `fornecedores`, `contasReceber`, stores de CRM/leads/campanhas; validar ligações e regras de crédito no servidor | Parcial — vendas, CRM, pipeline, campanhas e propostas identificados; contratos/avenças e bloqueio integral por crédito por fechar |
| M03 | PDV / Caixa | Terminal; pesquisa e leitura de código; carrinho; venda em espera; múltiplos pagamentos; caixa; abertura/fecho; sangria/reforço; devoluções; fidelização; cupões/vales; modo offline; fila idempotente de sincronização | Vendas, produtos, caixa, pagamentos, fidelidade/cupões; RPCs de finalização e idempotência; testes de concorrência e offline | Parcial/forte — PDV, caixa, split-screen, idempotência e sincronização têm código/testes; estacionamento e fidelização avançada a validar |
| M04 | Produtos e serviços | Catálogo; categorias/subcategorias; marcas; unidades; códigos de barras; variantes; kits; serviços; tabelas de preço; validades; lotes/séries; conversões de unidade; taxa e motivo de isenção fiscal | `produtos`, `categorias`, `lotes`; validar modelo de unidades, atributos fiscais e compatibilidade com documentos | Parcial — catálogo e validação de produtos existem; validade, conversões e classificação fiscal completa precisam de confirmação |
| M05 | Stock e armazém | Armazéns; entradas/saídas; movimentos; transferências; inventário físico; reservas; picking; localização corredor/prateleira; custo médio; valorização; lote/série/validade; perdas/quebras; reposição sugerida | `produtos`, `movimentacoesEstoque`, `estoqueArmazens`, `armazens`, `lotes`, `transferencias`, `inventarios`; usar transacções atómicas e rastreabilidade | Parcial — stock, armazéns, transferências e valorização foram identificados; localização interna, reposição e perdas contabilísticas a validar |
| M06 | Compras e aprovisionamento | Requisição; RFQ/cotações; mapa comparativo; aprovação por alçada; ordem de compra; recepção; factura de fornecedor; devolução; custos de importação/landed cost | `compras`, `fornecedores`, `recebimentos`, `contasPagar`, centros de custo e workflows; validar ciclo ordem→recepção→factura→pagamento | Parcial — compras/fornecedores e estruturas de cotação existem; ciclo completo, comparação e landed cost por concluir |
| M07 | Facturação e documentos fiscais | FT, FR, recibos, proforma, NC, ND, guias; séries e sequências; liquidação parcial/em lote; autofacturação; envio por e-mail/WhatsApp; arquivo e consulta | `ks_fiscal_documents`/ledger proposto, sequências por empresa/ano, vendas, recibos e devoluções; confirmar estado live das migrations e RPCs antes de activar | Parcial / bloqueado para uso fiscal real — documentos e sequências têm implementação em evolução; confirmar ledger, reconciliação e estado não certificado |
| M08 | Financeiro e contabilidade | Caixa; bancos; tesouraria; contas a pagar/receber; liquidação parcial; adiantamentos; câmbios; diferenças cambiais; cheques/letras; orçamento; centros de custo; diário; razão; balancete; demonstrações; reconciliação | `contasPagar`, `contasReceber`, `budgets`, `conciliacoes`, `transacoesBancarias`, diário/linhas contabilísticas e RPCs de dupla entrada | Parcial/forte na fundação contabilística — motor de dupla entrada, orçamento e aprovações identificados; reconciliação, liquidações e relatórios completos a validar |
| M09 | Recursos humanos e payroll | Funcionários; recrutamento; onboarding; departamentos; cargos; contratos; ponto; turnos; férias; ausências; folha salarial; IRT; INSS; subsídios; horas extra; recibos e mapas | `funcionarios`, `turnos`, `pontoDigital`, `ferias`, `folhasPagamento`, `beneficios`, políticas payroll; taxas e escalões devem ser parametrizados por vigência | Parcial — funcionários, workflows, férias, ponto e payroll identificados; cálculo legal, mapas e recibos carecem de validação fiscal/laboral actual |
| M10 | Indústria e produção / MRP | BOM/ficha técnica; matérias-primas; submontagens; MRP; plano; ordens; roteiros; centros de trabalho; capacidade; consumo; subprodutos; desperdício; qualidade; custo padrão/real; rastreabilidade | `producao`, `ordensProducao`, `mrp`, `boms`, `custosProducao`, `controleQualidade`, `planosProducao`; stores fabris aditivos existentes | Parcial/forte — BOM, MRP, roteiros, centros, custos e qualidade identificados; execução integrada com stock/contabilidade ainda exige validação |
| M11 | Serviços técnicos e manutenção | Ordens de serviço; tickets; agenda; contratos/avenças; SLA; checklists móveis; técnicos; peças; custos; garantia; portal do cliente e acompanhamento | `ordens de serviço`, `tickets`, `contratos`, `ativos`, `manutencoes`, colaboradores e facturação; confirmar SLA e portal externo | Parcial — ordens, técnicos, manutenção, tickets e contratos identificados; SLA, checklists e portal por validar |
| M12 | Comércio electrónico | Catálogo; loja; carrinho; checkout; gateway; pagamentos; encomendas; carrinho abandonado; avaliações/moderação; portal do cliente; sincronização de stock e pedidos | Integração gateway e encomendas; funções Edge e cofre cifrado; validar callbacks, assinatura, idempotência e reconciliação por provedor | Fundação existente / parcial — credenciais e conectores são armazenados; cobrança real e webhooks não estão comprovados |
| M13 | Logística, entregas e frota | Picking; expedição; rotas; GPS; motoristas; viaturas; combustível; manutenção; seguros/inspecções; e-POD com assinatura/foto; devoluções logísticas | `frotas`, `manutencoes`, `gpsTracking`, `abastecimentos`, `roteirizacao`, `transportadoras`; validar geolocalização, prova e custos | Parcial — frota, rotas, GPS, combustível e rastreio identificados; e-POD e manutenção preventiva completa a validar |
| M14 | Relatórios e estatísticas | Vendas; compras; stock; margem/lucro; clientes; fornecedores; caixa; financeiro; RH; produção; entregas; análise ABC; drill-down; construtor; exportação; envio agendado | Consultas agregadas tenant-scoped e dados reais; exports PDF/Excel; agendamento por servidor; evitar métricas calculadas apenas no browser | Parcial — dashboard, relatórios e análise de marketing identificados; construtor, ABC e agendamento planeados |
| M15 | Administração e segurança | Utilizadores; memberships; perfis; permissões por módulo/submódulo/acção; filiais; auditoria; sessões; 2FA; política de password; restrição por IP/horário; dispositivos | Auth, memberships, roles, permissões, auditoria, RLS, RPCs; 2FA e regras de sessão devem ser aplicadas no servidor | Parcial/forte — utilizadores, memberships, permissões e auditoria existem; 2FA e restrições avançadas precisam de validação |
| M16 | Centro de integrações | Supabase; APIs; conectores; webhooks; importação/exportação; sincronização; logs; retries; e-mail SMTP; WhatsApp Business; contabilidade externa | `integracoes`, cofre cifrado, Edge Functions `company-integrations` e `ecommerce-gateway`; nunca expor segredos no browser | Fundação existente — cofre e gestão de conectores existem; conectores de produção e callbacks por testar |
| M17 | Centro AGT / conformidade fiscal | Dados fiscais; certificados/JWS; ambiente de testes/produção; validação pré-envio; SAF-T AO; submissão/consulta; contingência; hashes; arquivo; logs e reconciliação | `integracoesAGT`, `fiscal-documents`, exportação SAF-T e provider; dependente de especificações e credenciais oficiais | Parcial / bloqueado por validação externa — SAF-T e fundação JWS existem; submissão real, contingência e certificação não comprovadas |
| M18 | Administração SaaS Kanawa Soft | Painel plataforma; empresas/clientes; planos; trials; licenças; pagamentos; billing; upgrade/downgrade; expiração/tolerância; limites; MRR/churn; revendedores/comissões | Tabelas `ks_*` de planos/licenças/pagamentos/instalações/auditoria e RPCs privilegiados; plataforma separada do tenant | Parcial — planos, termos, licenças e trial existem; pagamentos reais, billing self-service, métricas e parceiros a validar |
| M19 | Configurações gerais | Dados da empresa; filiais; moeda; IVA; séries; impressoras; modelos; temas; idioma; calendários/feriados; dicionário de termos; backups; offline/sync | `empresaConfig`, preferências, configurações fiscais e de workspace; parametrização por empresa e vigência | Parcial — configuração, preferências e idiomas existem; calendários e dicionário sectorial planeados |

## 3. Matriz de permissões padrão

As permissões são atribuídas por **empresa + utilizador + módulo + submódulo + acção**, com validação obrigatória no servidor. A interface pode ocultar acções sem permissão, mas isso não substitui a autorização no backend.

| Acção | Código sugerido | Aplicação |
|---|---|---|
| Visualizar | `read` | Consultar e pesquisar dados |
| Criar | `create` | Criar registos |
| Editar | `update` | Alterar registos permitidos |
| Eliminar | `delete` | Eliminar apenas quando o domínio permitir; documentos fiscais/ledger devem ser imutáveis |
| Aprovar | `approve` | Aprovar compras, descontos, despesas, pagamentos ou workflows |
| Exportar | `export` | Exportar dados e relatórios |
| Cancelar | `cancel` | Cancelar através de RPC auditada, sem apagar histórico |
| Configurar | `manage` | Alterar parâmetros do módulo |
| Administrar | `admin` | Gestão de utilizadores/permissões dentro do tenant, sem poderes sobre licenças da plataforma |

**Separação obrigatória:** o administrador da empresa cliente não é administrador da plataforma Kanawa Soft. Licenças, planos globais, emissão de chaves e aprovação de pagamentos SaaS são operações exclusivas da plataforma.

## 4. Modelo de dados e integração

1. **Tenant scope:** toda a operação empresarial deve resolver a empresa activa de forma explícita e verificar membership activa; nunca inferir a empresa escolhendo a primeira associação do utilizador.
2. **RLS:** todas as tabelas tenant-scoped devem ter RLS e políticas restritivas; operações críticas devem usar RPCs transaccionais com validação de papel e empresa.
3. **Persistência:** Supabase/PostgreSQL é a fonte principal cloud. IndexedDB é cache/offline e não deve ser apresentado como confirmação de persistência remota.
4. **Sincronização:** usar o adaptador existente e `ks_records` para colecções genéricas compatíveis; evitar duplicar stores e tabelas especializadas.
5. **Integridade:** vendas, pagamentos, movimentos de stock, documentos fiscais e lançamentos contabilísticos precisam de idempotência, bloqueio concorrente e transacção atómica.
6. **Auditoria:** acções de aprovação/cancelamento e eventos financeiros/fiscais devem ser append-only ou registados em trilho não editável pelo utilizador comum.
7. **Moeda e fiscalidade:** AOA/Kz como moeda base; câmbios datados; impostos e isenções configuráveis por vigência e sujeitos a revisão contabilística/fiscal angolana.
8. **Integrações externas:** credenciais cifradas no servidor; callbacks assinados, retries e idempotência; não activar cobrança ou envio fiscal real sem sandbox e homologação.

## 5. Critérios de aceitação por funcionalidade

Uma funcionalidade passa para **validada** somente quando:
- o fluxo de utilizador está completo, incluindo erros e estados vazios;
- os dados persistem no Supabase e reaparecem após novo login/dispositivo;
- uma empresa não consegue consultar ou alterar dados de outra;
- as permissões são verificadas no servidor em todas as operações;
- operações sensíveis são atómicas, idempotentes e auditadas;
- existem testes automatizados relevantes e teste manual com perfis diferentes;
- indicadores e gráficos reconciliam com os registos de origem;
- integrações externas passam sandbox, assinatura, timeout e retry;
- a documentação e as migrations correspondem ao esquema realmente aplicado.

## 6. Roadmap proposto

| Fase | Escopo | Condição para avançar |
|---|---|---|
| F0 — Segurança e fundação | Isolamento tenant, permissões, auditoria, licenças SaaS e persistência | CI verde, revisão de PR e teste isolado de RLS/RPC |
| F1 — Ciclo operacional | PDV, vendas, compras, stock, clientes, fornecedores, caixa e contas correntes | Fluxos completos e reconciliação de stock/caixa |
| F2 — Contabilidade e fiscalidade | Dupla entrada, períodos, facturação, recibos, SAF-T e validação AGT | Revisão contabilística/fiscal e validação de cada contrato RPC |
| F3 — Gestão avançada | RH/payroll, produção, projectos, serviços, logística e activos | Testes por perfil e por empresa |
| F4 — Inteligência e integrações | Dashboards reais, ABC, relatórios customizados, gateways, WhatsApp/e-mail | Dados reconciliados, sandbox e monitorização |
| F5 — SaaS Enterprise | Billing, self-service, MRR/churn, parceiros e comissões | Pagamentos verificados, segregação plataforma/tenant e limites server-side |

## 7. Riscos e decisões pendentes

- **AGT:** não declarar certificação nem activar emissão/submissão real antes da confirmação oficial e dos testes legais/operacionais.
- **IRT/INSS:** parametrizar escalões, taxas, limites e períodos conforme legislação em vigor; não fixar percentagens sem validação.
- **Multicaixa Express/referências:** a presença de campos de configuração não prova integração de cobrança, callbacks ou liquidação.
- **Offline:** definir política de conflitos, sequência, chaves idempotentes e prevenção de venda acima do stock disponível.
- **Relatórios:** definir fórmulas de lucro, custo médio, stock valorizado e margem; cada gráfico deve mostrar origem, período e filtro de empresa.
- **Dados legados:** não apagar os 146 stores locais nem migrar/remover colecções sem prova de compatibilidade e plano de rollback.
- **Migrations:** confirmar estado aplicado no projecto Supabase antes de criar novas alterações; o ficheiro no Git não prova que está aplicado.

## 8. Referências internas utilizadas

- `docs/ERP-MODULE-DATA-MAP.md` — catálogo de navegação, stores e domínios de dados.
- `docs/ERP_BENCHMARK_GAP_ANALYSIS.md` — estado funcional e lacunas por área.
- `docs/ENTERPRISE_MANAGEMENT_1_0.md` — administração, RH, payroll e SaaS.
- `docs/LEGAL_COMPLIANCE_AO.md` — registo de conformidade angolana.
- `docs/ERP_INTEGRATIONS_FOUNDATION.md` — cofre e conectores.
- `docs/POS_IDEMPOTENCY_AND_STOCK_CONCURRENCY.md` — idempotência e concorrência no PDV.
- `docs/SAFT_AO_ACCOUNTING_IMPLEMENTATION.md` — SAF-T AO e contabilidade.

## 9. Estado desta entrega

Esta matriz documenta e organiza os requisitos e o estado conhecido a partir dos documentos e ficheiros consultados no repositório. **Não implementa funcionalidades**, não executa SQL, não altera dados Supabase, não modifica o domínio e não publica em produção. Os estados são evidência documental/estática e devem ser confirmados por testes de ponta a ponta antes de declarar qualquer módulo concluído.


## 10. Regras de arquitectura funcional, navegação e UX

### 10.1 Profundidade e organização do menu

- Limitar a navegação a **três níveis**: Categoria → Módulo → Submódulo. Não criar um quarto nível de menu; opções internas devem ser separadores, tabs, filtros ou acções dentro do ecrã.
- Uma **categoria** agrupa departamentos ou grandes fluxos; um **módulo** representa uma área funcional; um **submódulo** representa uma rotina de negócio específica.
- O menu deve mostrar apenas módulos autorizados para a empresa, utilizador e plano contratado.
- O módulo controla a visibilidade/entrada na área; cada submódulo controla as acções autorizadas. A autorização efectiva deve ser validada no servidor em todas as operações.
- Não duplicar a mesma entidade em vários módulos. Cadastros mestres são reutilizados por vendas, compras, stock, facturação, RH e relatórios.

### 10.2 Estrutura padrão dos ecrãs operacionais

Sempre que fizer sentido para o tipo de rotina, cada submódulo deve adoptar o mesmo padrão:

1. **Lista principal (Data Grid):** pesquisa rápida, filtros avançados, ordenação, paginação, contagem e estados claros (rascunho, pendente, aprovado, pago, anulado, expirado, conforme aplicável).
2. **Acções rápidas:** abrir detalhe, imprimir/gerar PDF, enviar por canal configurado, duplicar quando permitido, aprovar, alterar estado ou cancelar por fluxo autorizado.
3. **Formulário de criação/edição:** secções consistentes, por exemplo Dados Gerais, Itens/Linhas, Impostos, Pagamentos, Anexos. Validar campos no cliente e no servidor.
4. **Vista de detalhe:** resumo, documentos relacionados, movimentos gerados, histórico de estados, autor, aprovador, datas e trilho de auditoria.
5. **Estados vazios e erros:** explicar o que falta, permitir retry seguro e nunca apresentar dados de demonstração como dados reais.

As acções disponíveis devem variar conforme estado, papel, permissões e natureza legal do registo. A opção de duplicar cria um novo rascunho; nunca duplica silenciosamente movimentos financeiros ou fiscais.

### 10.3 Fronteiras de domínio e propriedade dos dados

| Domínio | Conteúdo principal | Regra de integridade |
|---|---|---|
| Cadastros base (master data) | Clientes, fornecedores, produtos, serviços, colaboradores, bancos, caixas, unidades, categorias e contactos | Registos referenciados por movimentos não são apagados fisicamente; devem ser inactivados/arquivados, preservando referências e histórico. |
| Operações comerciais e logísticas | Orçamentos, encomendas, requisições, ordens de compra, guias operacionais, recepções, entradas/saídas e transferências | Podem reservar ou movimentar stock conforme o tipo de documento; não criam automaticamente recebimento ou pagamento. A conversão para factura/pagamento é um fluxo explícito e rastreável. |
| Facturação e fiscalidade | Facturas, facturas-recibo, notas de crédito/débito, documentos fiscais, séries, SAF-T AO e arquivo | Documento fiscal emitido/assinado é imutável. Correcção segue mecanismo legal aplicável (por exemplo, nota de crédito ou anulação formal), preservando original, motivo, referência e auditoria. |
| Tesouraria e financeiro | Contas a receber/pagar, recibos, pagamentos, caixas, bancos, transferências e reconciliação | A factura pode originar um título a receber; o recibo/pagamento liquida total ou parcialmente esse título e regista entrada/saída de caixa/banco. A operação deve ser atómica, conciliável e idempotente. |
| Configurações e sistema | Séries, impostos, isenções, formas de pagamento, utilizadores, perfis, calendários, parâmetros e logs | Configurações críticas restritas a administradores autorizados do tenant; alterações sensíveis exigem auditoria e, quando aplicável, aprovação. |

**Nota sobre documentos logísticos:** a classificação jurídica de uma guia ou documento de transporte depende da sua natureza e das regras aplicáveis. O ERP deve distinguir documentos operacionais internos de documentos legalmente fiscais, em vez de assumir que todos têm o mesmo efeito tributário.

### 10.4 Regras transaccionais obrigatórias

- Uma encomenda pode reservar stock, mas não deve criar dívida financeira por si só, salvo quando exista adiantamento ou regra contratual explícita.
- Uma recepção de mercadoria actualiza stock apenas após validação da recepção; a factura do fornecedor e a obrigação a pagar devem ser ligadas ao documento de origem, sem duplicar o movimento físico.
- A emissão fiscal e a criação do título financeiro associado devem ocorrer na mesma transacção lógica, ou através de uma saga auditada com recuperação e idempotência.
- Um recibo não deve alterar directamente o estado de uma factura sem liquidar o título correspondente e actualizar o meio de tesouraria.
- Cancelamentos e estornos devem criar movimentos inversos/referenciados; nunca apagar o histórico original.
- Produtos, clientes, fornecedores e contas já usados em movimentos não podem ser eliminados fisicamente por utilizadores operacionais.
- Os relatórios devem obter os valores dos movimentos de origem e apresentar período, empresa, moeda, filtros e fórmula utilizada.

### 10.5 Separação de funcionalidades por planos SaaS

A disponibilidade comercial é uma camada adicional à autorização do utilizador. Um utilizador não ganha acesso por ter permissão se o plano da empresa não incluir a funcionalidade.

| Grupo de plano (proposta) | Capacidades |
|---|---|
| Base / Mini | Cadastros, vendas, PDV essencial, compras, stock, caixa, clientes/fornecedores e relatórios operacionais básicos |
| Profissional / Standard | CRM avançado, múltiplos armazéns, compras com aprovações, financeiro avançado, relatórios comparativos, integrações seleccionadas e automações |
| Enterprise / Premium | Multi-filial avançado, produção/MRP, RH/payroll avançado, serviços técnicos/SLA, loja online, logística/frota, construtor de relatórios, APIs e controlos avançados |

A tabela é uma proposta funcional, não altera os preços nem os planos actualmente registados. O catálogo comercial real já identificado (Mini 15.000 Kz/mês, Standard 35.000 Kz/mês, Premium 75.000 Kz/mês) deve ser reconciliado com esta matriz antes de activar qualquer feature gate.

Requisitos técnicos:
- Manter um catálogo central de features com identificadores estáveis, por exemplo `inventory.multi_warehouse`, `manufacturing.mrp`, `commerce.storefront`, `service.sla`.
- Associar features a planos e limites; resolver o entitlement no servidor com cache curta e invalidação após alteração de subscrição.
- Validar simultaneamente: empresa activa, subscrição/licença válida, feature incluída, utilizador/membership activa e permissão da acção.
- A interface pode ocultar ou explicar módulos indisponíveis, mas não é a barreira de segurança.
- Downgrade/expiração não deve apagar dados; deve bloquear novas operações premium conforme política e permitir consulta/exportação de dados nos termos definidos.

### 10.6 Árvore de navegação de referência

A árvore abaixo é uma proposta de organização; deve ser mapeada para os IDs e renderers existentes, sem duplicar módulos:

- **Dashboard**
- **Comercial**
  - Clientes e contactos
  - Orçamentos e encomendas
  - Facturação e documentos
  - Ponto de Venda (PDV)
  - CRM e contratos
- **Compras & Stock**
  - Fornecedores
  - Ordens de compra e recepções
  - Produtos e serviços
  - Movimentos de stock
  - Armazéns e inventário
- **Financeiro**
  - Contas correntes (a receber / a pagar)
  - Tesouraria (caixas e bancos)
  - Despesas e pagamentos
  - Contabilidade e relatórios financeiros
- **Operações específicas** (activáveis por plano)
  - Recursos Humanos
  - Produção / Indústria
  - Serviços técnicos
  - Loja online e entregas
  - Frota e manutenção
- **Gestão & Sistema**
  - Relatórios e estatísticas
  - Integrações e AGT / SAF-T
  - Administração e permissões
  - Configurações gerais
- **Administração Kanawa Soft** (apenas plataforma)
  - Empresas, planos e licenças
  - Pagamentos SaaS e billing
  - Métricas e parceiros

O grupo Administração Kanawa Soft deve permanecer separado do menu do tenant. Um administrador de uma empresa cliente não pode aceder a operações exclusivas da plataforma.

## 11. Critérios adicionais de validação UX e domínio

Antes de marcar um submódulo como validado, confirmar também:
- profundidade máxima de três níveis no menu;
- consistência da lista, formulário, detalhe e acções rápidas;
- ausência de duplicação de cadastros ou de fontes de verdade;
- inactivação em vez de eliminação de cadastros referenciados;
- imutabilidade dos documentos fiscais emitidos;
- correspondência entre factura, título a receber, recibo e movimento de caixa/banco;
- gates de plano no servidor, separados das permissões de utilizador;
- comportamento de downgrade/expiração sem perda de dados;
- acessibilidade e responsividade em desktop e telemóvel.
