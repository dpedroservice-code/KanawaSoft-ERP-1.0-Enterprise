# Mapa de módulos e dados — Kanawa Soft ERP 1.0 Enterprise

**Auditoria estática e de catálogo:** 10 de Novembro de 2026  
**Âmbito:** branch `feat/kanawa-theme-layout-customizer-preview9`, PR #11 e leitura de metadados do projecto Supabase.  
**Regra de segurança:** esta auditoria não altera dados, não aplica DDL e não remove colecções.

## 1. Navegação e módulos

A navegação está organizada em dez áreas principais:

| Área | Módulos principais e submódulos |
|---|---|
| Vendas e Canais | PDV, Caixa, Vendas, Orçamentos, E-commerce, Pedidos, Pagamentos, Rastreio, Consignação e Promoções |
| Produtos e Logística | Produtos, Categorias, Stock, Compras, Fornecedores, Transportadoras, Armazéns, Picking, Etiquetas, Transferências e Rastreio |
| Produção e MRP | Produção, BOM/Ficha Técnica, Planos, Ordens, MRP, Custos e Controlo de Qualidade |
| Clientes e CRM | Clientes, Fidelidade, Cupões, Portal, Segmentação, Pipeline, Leads, Campanhas, Automação, Score e Remarketing |
| Financeiro e Contabilidade | Financeiro, Fiscal, Contabilidade, Despesas, Orçamento Empresarial, Contas a Pagar/Receber e Conciliação |
| Recursos Humanos | Funcionários, Recrutamento, Onboarding, Departamentos, Documentos, Ponto, Turnos, Férias, Folha Salarial, Benefícios, Desempenho e Rescisão |
| Projectos e Serviços | Projectos, Tarefas, Kanban, Gantt, Timesheets, Custos, Riscos, Recursos, Ordens de Serviço e Agenda |
| Frotas e Activos | Activos, Frota, Manutenção, Depreciação, Garantias, Rotas, GPS, Combustível, Documentos e Multas |
| Administração | Documentos, Contratos, Tickets, Utilizadores, Auditoria, Dispositivos, Licenças, Integrações, Relatórios e Conformidade |
| Formação e EAD | Cursos, Quizzes, Certificações, Progresso e Relatórios |

O mapa de renderização foi verificado contra os IDs do menu. Os dois atalhos de manutenção (activos e frota) usam intencionalmente o mesmo ecrã/histórico unificado; as chaves duplicadas do mapa de renderização foram removidas.

## 2. Colecções locais (IndexedDB)

- O registo `DB_STORES` contém **146 object stores**.
- Foram encontrados **84 nomes de colecção** referenciados directamente por chamadas de leitura/escrita no núcleo `app.js`.
- Todas as colecções directamente referenciadas existem em `DB_STORES`.
- Existem **62 stores sem referência literal directa** no núcleo. Podem ser legado, compatibilidade, funcionalidades chamadas dinamicamente ou módulos ainda não activados.

**Não remover os 62 stores sem uma migração comprovada.** A ausência de referência literal não prova que estejam vazios nem que não existam dados locais antigos. A versão actual mantém todos os stores para preservar compatibilidade.

### Colecções centrais por domínio

| Domínio | Colecções centrais |
|---|---|
| Vendas | `vendas`, `orcamentos`, `vendasConsignadas`, `devolucoes`, `contasReceber` |
| Produtos e stock | `produtos`, `categorias`, `movimentacoesEstoque`, `estoqueArmazens`, `armazens`, `lotes`, `transferencias`, `inventarios` |
| Compras | `compras`, `fornecedores`, `recebimentos`, `transportadoras` |
| Produção | `producao`, `ordensProducao`, `mrp`, `boms`, `custosProducao`, `controleQualidade`, `planosProducao`, `previsoesVendas` |
| Financeiro | `contasPagar`, `contasReceber`, `folhasPagamento`, `budgets`, `forecasts`, `conciliacoes`, `transacoesBancarias` |
| RH | `funcionarios`, `turnos`, `pontoDigital`, `ferias`, `vagas`, `candidatos`, `beneficios`, `desempenhoRH`, `rescisoes` |
| Projectos | `projetos`, `tarefas`, `tarefasProjetos`, `atividadesProjetos`, `timesheets`, `membrosProjetos`, `ganttProjetos` |
| Activos e frota | `ativos`, `frotas`, `manutencoes`, `ordensManutencao`, `garantias`, `gpsTracking`, `abastecimentos`, `roteirizacao`, `multas` |
| Administração | `usuarios`, `auditoria`, `notificacoes`, `dispositivos`, `empresaConfig`, `integracoesAGT`, `backups`, `logsSeguranca` |
| Formação | `cursos`, `quizzes`, `certificacoes`, `audiobooks` |

Esta tabela é um mapa de domínio, não uma autorização para criar novas tabelas ou duplicar colecções. Alguns módulos partilham dados e os adaptadores existentes continuam a ser a fonte de verdade.

## 3. Supabase — catálogo e segurança

Na leitura de metadados do projecto Supabase:

- Foram identificadas **103 tabelas públicas**.
- **Todas as 103 têm Row Level Security (RLS) activado**; não foi encontrada tabela pública com RLS desligado.
- `ks_records` é o repositório genérico de sincronização das colecções locais, com escopo por empresa e `store_key`.
- O adaptador também usa tabelas especializadas (por exemplo, vendas, produtos, stock, compras, colaboradores, contabilidade e produção). Não se deve criar uma segunda tabela para uma colecção já suportada por `ks_records` sem uma decisão de arquitectura e migração.
- `ks_auth_otp_rate_limits` tem RLS activado e nenhuma policy. Isto bloqueia o acesso por utilizadores sujeitos a RLS; manter assim enquanto a tabela for exclusiva de operações privilegiadas no servidor. Não criar policy pública por conveniência.
- O advisor de segurança sinalizou a protecção contra palavras-passe comprometidas como desactivada. É uma configuração de Auth a rever no painel Supabase; não foi alterada nesta revisão.
- O advisor de performance sinalizou uma chave estrangeira sem índice em `ks_journal_entries.created_by_user_id`. Deve ser avaliada numa migração própria, após confirmar o padrão de consulta.
- O advisor reportou índices ainda não utilizados. Não os remover apenas com base nisso: tabelas novas ou com pouco tráfego podem ainda não ter estatísticas representativas.

## 4. Consistência de tabelas na interface

Foi acrescentado um melhoramento transversal aos ecrãs que usam o helper comum `table(headers, rows)`:

- pesquisa por texto em cada tabela;
- ordenação ascendente/descendente ao clicar no cabeçalho;
- contagem de registos visíveis e total;
- ordenação numérica com suporte a números formatados em português e datas ISO;
- preservação das linhas e dos botões de acção existentes;
- estilos que herdam as variáveis do tema actual e se adaptam a ecrãs pequenos.

A funcionalidade é apenas de apresentação: não modifica, grava, apaga ou reordena os dados na base de dados.

## 5. Validação e limites conhecidos

- Foram adicionados testes para validar a correspondência entre menu e renderizadores, a unicidade das chaves do mapa, a existência dos stores usados, o carregamento do melhoramento das tabelas e a apresentação da pilha técnica quando um módulo falha.
- O erro `Maximum call stack size exceeded` não pode ser atribuído com segurança a um módulo específico apenas pela mensagem. A interface passa a preservar o ID do módulo e a apresentar até dez linhas da pilha técnica em **Detalhes técnicos para suporte**, para identificar a chamada exacta se o erro persistir.
- A validação automatizada não substitui os testes reais no navegador com diferentes perfis, empresas, temas, resoluções e dados.
- Não foram executadas alterações no esquema Supabase, não foram apagados stores, não foram alterados registos reais e não foi feito merge nem deploy de produção.
