# Kanawa Soft ERP 1.0 — Matriz Técnica Enterprise

**Data:** 2026-11-13  
**Repositório:** `dpedroservice-code/KanawaSoft-ERP-1.0-Enterprise`  
**Finalidade:** baseline de módulos, melhorias, permissões e auditoria técnica.

## 1. Regras de evolução

- Preservar a aplicação unificada existente; não criar ERP paralelo nem duplicar menus, serviços ou tabelas.
- Supabase/PostgreSQL é a fonte central da versão cloud. IndexedDB/LocalStorage só podem funcionar como cache/fila offline com regras explícitas.
- Toda a leitura/escrita operacional respeita `company_id`, membership activa, permissões e RLS.
- As permissões são verificadas no servidor; esconder botões não é controlo de segurança.
- Dashboards usam dados reais, com período, filtros e fórmulas identificáveis.
- Migrações são revistas, testadas e nunca aplicadas à produção sem aprovação explícita.
- Não declarar certificação AGT sem aprovação formal.

## 2. Legenda de estado

- **Evidência no código:** existe menu, função, componente ou integração relacionada; ainda exige teste funcional.
- **Parcial / validar:** há estruturas ou partes do fluxo, mas falta confirmar persistência, segurança ou ponta-a-ponta.
- **Por auditar:** esta leitura inicial não encontrou evidência suficiente.
- **Planeado:** melhoria desejada sem evidência funcional confirmada.

## 3. Matriz funcional dos 19 domínios

| # | Área | Módulos/submódulos identificados no repositório | Melhorias Enterprise a incluir | Estado inicial |
|---|---|---|---|---|
| 1 | Painel principal | `dashboard`; gráficos de vendas, stock, finanças, compras e margens | Comparativos temporais, liquidez prevista 7/15/30 dias, rankings e fórmulas transparentes | Parcial: validar origem real e fórmulas |
| 2 | Gestão comercial | `vendas`, `orcamentos`, `clientes`, `fornecedores`, `crm`, `contratos`, `marketing-campanhas` | Avenças, campanhas por regras, bloqueio de crédito por limite/atraso e aprovações | Evidência no código; fluxos por validar |
| 3 | PDV | `pdv`, `caixa`, `vendas`, `clientes-fidelidade`, `clientes-cupons` | Offline com fila idempotente, vendas estacionadas, pagamentos repartidos, pontos e vales | Parcial: validar offline e pagamentos |
| 4 | Produtos e serviços | `produtos`, `categorias`, `servicos`, `tabelas-precos`, `produtos-avaliacoes` | Lotes/validade, taxas e isenções por artigo, conversão de unidades e variantes | Evidência no código; regras por validar |
| 5 | Stock e armazém | `estoque`, `logistica-armazens`, `logistica-picking`, `logistica-etiquetas` | Corredor/prateleira, reposição por procura/lead time, perdas, inventário e custo médio | Parcial: validar movimentos e cálculo |
| 6 | Compras | `compras`, `fornecedores`, `transportadoras` | Cotações comparativas, landed cost, alçadas, recepção parcial e devoluções | Evidência no código; landed cost por auditar |
| 7 | Facturação e documentos fiscais | `fiscal`, `conformidade`, `documentos`; `app/fiscal-documents.js` | Autofacturação quando aplicável, envio WhatsApp/SMS, liquidação em lote, séries e arquivo | Parcial: validar ponta-a-ponta e lei |
| 8 | Financeiro e contabilidade | `financeiro`, `contabilidade`, `despesas-gerais`, `orcamento-empresa` | Multimoeda/câmbios, diferenças cambiais, cheques/letras, orçamento vs realizado | Evidência no código; funções por auditar |
| 9 | RH | `rh`, `folha-salarial`, `rh-documentos`, `rh-ponto`, `rh-beneficios`, `ferias-dispensas`, `rh-recrutamento` | IRT/INSS com tabelas legais versionadas, recibos em lote, subsídios e horas extra | Parcial: validar cálculos e lei vigente |
| 10 | Indústria e produção | `producao`, `ordens-producao`, `mrp`, `bom`, `custos-producao`, `controle-qualidade`, `planos-producao` | Roteiros/centros de trabalho, subprodutos, sucata e custo padrão vs real | Evidência no código; custos por validar |
| 11 | Serviços técnicos | `os`, `os-manutencao`, `os-checklist`, `os-tecnicos`, `os-calendario`, `tickets`, `agenda` | SLA, checklists móveis, portal seguro de acompanhamento, peças e garantias | Evidência no menu; fluxos por validar |
| 12 | E-commerce | `ecommerce-vitrine`, `ecommerce-carrinho`, `ecommerce-pedidos`, `ecommerce-pagamento`, `ecommerce-rastreio`, `portal-cliente` | Gateways locais, validação de pagamento, carrinhos abandonados e avaliações | Parcial: validar gateways reais |
| 13 | Logística e entregas | `logistica-roteirizacao`, `logistica-rastreio`, `transportadoras`, `frota`, `frota-gps`, `frota-combustivel` | Manutenção da frota, consumo/km, seguros, inspecções e e-POD | Evidência no menu; e-POD por validar |
| 14 | Relatórios | `relatorios`, `marketing-analise`, gráficos do dashboard | Construtor, envio agendado, análise ABC, exportação e filtros auditáveis | Parcial: validar origem e agendamento |
| 15 | Administração e segurança | `usuarios`, `auditoria`, `config`, `perfil`, `dispositivos`, `modulos` | Permissões granulares, 2FA, política de senhas, sessões e restrições IP/horário | Parcial; segurança SaaS em revisão |
| 16 | Centro de integrações | `integracoes`; ponte em `app/cloud.js` | APIs/webhooks, SMTP, WhatsApp Business, exportação contabilística, logs e retries | Evidência no código; conectores por validar |
| 17 | Centro AGT | `fiscal`, `conformidade`; utilitários em `server/agt` e `supabase/functions` | Validador pré-envio, contingência, arquivo cifrado, hashes e monitor de comunicação | Parcial; não significa certificação AGT |
| 18 | Administração SaaS | `licenca`; planos, termos, licenças, instalações e pagamentos | Billing self-service, MRR/churn, upgrade/downgrade, revendedores e limites server-side | Parcial: pagamentos/billing por validar |
| 19 | Configurações gerais | `config`, `idioma`, `perfil`, `dispositivos`, `preferencias` | Feriados nacionais/municipais, calendários, dicionário de termos, impressoras e backups | Evidência no menu; funções por auditar |

## 4. Evidência técnica localizada

### Interface e aplicação
- `app/index.html`: entrada oficial da aplicação.
- `app/app.js`: lógica principal e catálogo de módulos.
- `app/sidebar.js`: navegação por categorias e controlo de acesso na interface.
- `app/module-reorganization.js`: reorganização funcional.
- `app/industrial-manufacturing.js` e `app/industrial-enterprise.js`: produção.
- `app/fiscal-documents.js`: primitivas de documentos fiscais; o próprio módulo não declara certificação.
- `app/cloud.js`: autenticação e ponte Supabase.
- A navegação identificada tem 11 categorias principais e módulos de PDV, caixa, vendas, produtos, stock, compras, CRM, produção/MRP/BOM, financeiro, fiscal, RH, projectos, serviços, frota, logística, e-commerce, documentos, auditoria e configurações.

### Tabelas/entidades referenciadas pelo cliente Supabase
- Empresa/identidade: `ks_companies`, `ks_profiles`, `ks_company_memberships`, `ks_company_module_settings`.
- Operação: `ks_records`, `ks_products`, `ks_sales`, `ks_sale_items`, `ks_sales_returns`, `ks_cash_sessions`.
- Fiscal: `ks_fiscal_documents`, `ks_tax_rule_catalog`, `ks_tax_returns`.
- SaaS: `ks_saas_plans`, `ks_license_terms`, `ks_company_licenses`, `ks_installations`, `ks_payment_requests`.
- Segurança/auditoria: `ks_audit_events`.
- RH/gestão: `ks_employees`, `ks_employee_documents`, `ks_employee_compensation_history`, `ks_payroll_runs`, `ks_payroll_items`, `ks_budgets`, `ks_calendar_events`.

A referência no cliente não prova a definição integral da tabela, constraints, índices, RLS, políticas ou cobertura das migrações. É necessário comparar com as migrações e o schema real.

## 5. Matriz mínima de permissões

Permissões atribuíveis por empresa, utilizador/função e módulo/submódulo:

| Código | Acção | Regra |
|---|---|---|
| `view` | Visualizar | Só dados da empresa autorizada |
| `create` | Criar | Criar registos no âmbito autorizado |
| `edit` | Editar | Alterar registos permitidos, respeitando estado |
| `delete` | Eliminar | Preferir arquivo lógico; impedir eliminação de auditoria/documentos fiscais |
| `approve` | Aprovar | Separar do criador quando houver alçada |
| `cancel` | Cancelar | Exigir motivo, autorização e auditoria |
| `export` | Exportar | Aplicar escopo empresarial e registar exportação |

Regras críticas:
- Licenças e administração da plataforma SaaS são exclusivas do administrador da plataforma, não do administrador de uma empresa cliente.
- O utilizador não escolhe livremente `company_id` para contornar membership activa.
- RLS é a barreira final; a interface não substitui autorização no backend.
- Operações financeiras, fiscais e de stock devem registar actor, empresa, data, origem e motivo quando aplicável.

## 6. Plano de auditoria técnica

1. Extrair IDs de módulos, funções de renderização, rotas e permissões de `app/app.js`.
2. Cruzar cada módulo com CRUD, tabelas, RPCs e verificações de permissão.
3. Inventariar migrações Supabase: tabela → company_id → RLS → políticas → índices → RPC.
4. Identificar entidades guardadas em `ks_records` ou stores locais e avaliar normalização sem migração destrutiva.
5. Testar com duas empresas isoladas: PDV/vendas, stock, compras, caixa, facturação, RH e licenças.
6. Reconciliar gráficos do dashboard com consultas SQL de referência.
7. Converter lacunas confirmadas em tarefas pequenas, com testes e preview isolado.

## 7. Critérios de aceitação Enterprise

- Uma empresa não consegue ler nem alterar dados de outra.
- Uma empresa cliente não consegue emitir/alterar a própria licença nem auto-aprovar pagamentos.
- Auditoria é append-only para utilizadores normais.
- Stock não fica negativo por concorrência ou sincronização duplicada.
- Sincronização offline é idempotente e conflitos são explícitos.
- Indicadores reconciliam com registos de origem.
- Documentos fiscais preservam snapshot, série, numeração, hash e histórico.
- Testes e preview passam antes da integração na branch principal.
- Produção, domínio `kanawasoft.shop` e dados reais Supabase só mudam com aprovação explícita.

## 8. Limitações desta baseline

Esta primeira matriz foi construída a partir da navegação, ficheiros da aplicação e referências Supabase visíveis. Não substitui auditoria completa de migrações, RLS, RPCs, formulários, testes E2E e dados reais. O estado de cada funcionalidade só deve ser promovido com evidência reproduzível.
