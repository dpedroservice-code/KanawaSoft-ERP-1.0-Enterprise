# Auditoria comparativa funcional — Kanawa Soft ERP 1.0

## Objectivo e limites
Esta auditoria usa documentação pública de soluções ERP empresariais como referência de processos. Não reutiliza código, marcas, textos, ecrãs, templates ou outros activos proprietários. O Kanawa Soft mantém identidade, nomenclatura, interface e implementação próprias.

A comparação é funcional, não uma certificação nem uma afirmação de equivalência integral a qualquer produto de terceiros. Os módulos só serão marcados como concluídos depois de testes funcionais, persistência cloud, isolamento multiempresa e validação de permissões.

## Estado observado na branch feat/erp-integrations-preview

| Área funcional | Estado observado | O que já existe | Lacuna a fechar |
|---|---|---|---|
| Vendas, POS, faturação, devoluções | Parcial/forte | PDV, vendas, documentos, modelos de fatura, sequência por empresa/ano | Notas de crédito/débito, devolução ligada a stock/contas, trilho completo de documentos e testes de reconciliação |
| Compras e aprovisionamento | Parcial | Compras, fornecedores, encomendas/quotations em schema | Requisição interna, comparação de cotações, aprovação por valor, ordem -> recepção -> factura fornecedor -> pagamento |
| Inventário e armazéns | Parcial | Produtos, stock, movimentos, armazéns, picking, etiquetas, transferências/logística | Lotes, números de série, validade, inventário físico com contagem, valorização consistente, stock reservado/disponível e rastreabilidade |
| CRM e vendas B2B | Parcial | Leads, CRM, pipeline, campanhas, propostas/orçamentos | Contas empresariais/contactos múltiplos, actividades, previsão de vendas, conversão completa proposta -> contrato -> ordem -> factura |
| Contas a pagar/receber | Parcial | Ecrã financeiro básico com contas a pagar/receber | Vencimentos por parcela, liquidação parcial, adiantamentos, notas de crédito, antiguidade de saldos, cobrança e previsão de caixa |
| Contabilidade geral | Parcial — primeira fundação adicionada | Plano de contas, diário e linhas; nova interface, consulta do diário e lançamento manual de dupla entrada com validação server-side | Períodos, razão, balancete, demonstrações financeiras e ligação automática aos documentos ainda pendentes |
| Tesouraria e bancos | Parcial/crítica | Tabelas de contas bancárias, reconciliações, pagamentos e câmbios existem | Extratos/importação, movimentos, reconciliação linha-a-linha, caixa por conta, transferências, previsão de tesouraria e validação |
| Orçamentos e controlo | Parcial | Centros de custo, orçamentos, linhas e aprovações | Orçamento por conta/departamento/período, realizado vs previsto, desvios, revisão e bloqueios configuráveis |
| Recursos humanos | Parcial/forte | Funcionários, documentos, folha salarial, férias, ponto, recrutamento, desempenho | Escalas/turnos, processamento auditável por período, recibos, mapas, formação e workflows completos |
| Activos e equipamentos | Parcial | Cadastro de activos, depreciação, garantias e manutenção | Aquisição/capitalização, componentes, método e calendário de depreciação, transferência, reavaliação, abate e integração contabilística |
| Manutenção e serviços | Parcial/forte | Ordens de serviço, técnicos, manutenção, planos, tickets e contratos | SLA, contratos de assistência, agenda técnica, peças/consumo, custos reais, relatório do cliente e facturação da intervenção |
| Projectos e obras | Parcial/forte | Projectos, tarefas, Kanban, Gantt, recursos, timesheet, custos e riscos | Orçamento base, autos de medição, compras por obra, subempreitadas, facturação por marcos e margem final |
| Produção e qualidade | Parcial/forte | BOM, MRP, roteiros, ordens, centros de trabalho, custos e qualidade | Planeamento de capacidade, ordens por lote, consumo real, desperdício, rastreabilidade e não conformidades com acções correctivas |
| Logística e distribuição | Parcial | Armazéns, picking, rotas, etiquetas, cross-docking e rastreio | Expedição confirmada, prova de entrega, devolução logística, custos de transporte e integração de stock/facturação |
| Comércio externo | Ausente/parcial | Câmbios existem | Processo de importação/exportação, custos de aquisição, documentos, taxas, contentores, landed cost e liquidação cambial |
| Gestão multiempresa/filiais | Parcial | Empresas e memberships isolados por company_id, dados legais e perfis | Filiais/estabelecimentos operacionais, consolidação, operações intercompanhia e permissões entre empresas |
| Relatórios e análise | Parcial | Dashboard, relatórios e análise de marketing | Construtor de relatórios, indicadores financeiros, drill-down, exportações e dashboards por perfil |
| Aprovações e auditoria | Parcial/forte | Pedidos, workflows, etapas e eventos de auditoria | Regras por valor, departamento, substituição, delegação, SLA e histórico imutável de decisão |
| Integrações | Fundação | Segredos cifrados, gateway de e-commerce, registo de conectores | Testes de contrato, webhooks idempotentes, monitorização, retries, OAuth e conectores activados só com consentimento |

## Prioridade de implementação

### P0 — Integridade financeira e documental
1. Motor de lançamentos contabilísticos de dupla entrada, com validação de débito = crédito e numeração sequencial por diário/período.
2. Ligação de vendas, compras, recebimentos, pagamentos, salários, activos e stock aos lançamentos contabilísticos sem duplicação.
3. Tesouraria: contas bancárias, caixa, movimentos, importação de extratos e reconciliação.
4. Contas correntes: liquidações parciais, adiantamentos, vencimentos e antiguidade de saldos.
5. Períodos contabilísticos, fecho/reabertura com autorização e trilho de auditoria.

### P1 — Operações avançadas
1. Compras completas: requisição, RFQ/cotações, comparação, aprovação, ordem, recepção, factura e pagamento.
2. Inventário avançado: lotes, série, validade, contagem física, reservas e valorização.
3. Activos: ciclo de vida e depreciação integrada.
4. Serviços e manutenção: contratos, SLA, agenda, peças, custos e facturação.
5. Comércio externo e custo de importação.

### P2 — Escala e inteligência
1. Consolidação multiempresa/filiais e operações intercompanhia.
2. Planeamento de capacidade e produção por lote.
3. Reporting com drill-down e construtor de indicadores.
4. Integrações externas com monitorização e gestão de falhas.

## Regras de implementação
- Não criar um segundo módulo se já existe um módulo equivalente: ampliar o existente e reutilizar os dados.
- Não marcar como concluído apenas por existir uma tabela ou botão. Exigir fluxo completo, validação, persistência, permissões, isolamento por empresa e testes.
- Usar moeda base AOA por defeito, com moedas adicionais e taxa datada quando configuradas.
- Não fixar regras fiscais/laborais sem parametrização e revisão local.
- Os módulos sectoriais devem ser activáveis por perfil e configuração, sem impor campos irrelevantes a todas as empresas.
- Toda a nova UI deve seguir o design system do Kanawa Soft, sem reproduzir a aparência de produtos de referência.

## Referências públicas consultadas
- SAP Business One — funcionalidades de finanças, vendas, compras, inventário e reporting: https://www.sap.com/africa/products/erp/business-one/features.html
- SAP S/4HANA Cloud — áreas de finanças, activos, procurement, manufacturing, serviços, projectos e supply chain: https://learning.sap.com/products/s4hana-cloud
- SAP Help — áreas funcionais e processos: https://help.sap.com/docs/SAP_S4HANA_CLOUD/9d794cbd48c648bc8a176e422772de7e/e237c247cc454f1b8307e52d0624d0f4.html
- Cegid Primavera — documentação pública da API por áreas: https://v10api.primaverabss.com/html/index.html
- Cegid Primavera — áreas funcionais e reporting: https://campaigns.primaverabss.com/acton/media/17591/erp-cegid-primavera-evolution-cloud
- Formação funcional ERP Primavera — compras, vendas, stocks, tesouraria, financeira, RH, equipamentos e activos: https://www.primaverabss.com/pt/UserFiles/Downloads/APG003_Uma_visao_pratica_de_gestao_com_o_ERP_PRIMAVERA_%28CV%29.pdf

## Estado
Esta matriz é a primeira auditoria documental do branch. Ainda não representa conclusão dos módulos P0/P1/P2 nem validação visual. O branch permanece isolado; não fazer merge nem publicar em produção sem aprovação expressa.

## Actualização de implementação — fundação contabilística
- Adicionada migração `20261107128000_accounting_double_entry_engine.sql` no branch e aplicada ao projecto isolado.
- Adicionadas RPCs tenant-scoped para consultar o plano de contas/diário, criar ou actualizar contas e lançar movimentos contabilísticos.
- O lançamento valida no servidor: permissões da empresa, contas activas da mesma empresa, pelo menos duas linhas, apenas débito ou crédito por linha e total de débito igual ao crédito.
- A numeração do diário é sequencial por empresa/ano e protegida por advisory lock transaccional.
- Adicionada interface inicial em Contabilidade, plano de contas, diário e balancete por conta, além de wrappers no cliente cloud.
- Isto é uma fundação funcional; ainda não existe integração automática com vendas, compras, salários, activos e tesouraria, nem relatórios contabilísticos completos.
- O balancete soma apenas linhas de lançamentos com estado `posted`; rascunhos ou outros estados não entram nos saldos apresentados.\n