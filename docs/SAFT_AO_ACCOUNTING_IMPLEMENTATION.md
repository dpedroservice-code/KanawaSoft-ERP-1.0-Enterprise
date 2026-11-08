# SAF-T (AO) — exportação de contabilidade

## Âmbito desta etapa

Esta etapa cria um motor XML para o ficheiro de contabilidade (TaxAccountingBasis = C), com cabeçalho, plano de contas, saldos de abertura e encerramento, movimentos contabilísticos confirmados, linhas de débito/crédito e validações de consistência.

O ficheiro contabilístico deve ser único para o período de tributação. Os movimentos de abertura não são exportados como transacções: os saldos iniciais são representados nas contas do razão.

## Base técnica e fonte do XSD

- Estrutura legal: Decreto Executivo n.º 317/20, de 14 de Dezembro.
- Esquema: schemas/agt/SAFTAO1.01_01.xsd.
- Fonte: https://github.com/assoft-portugal/SAF-T-AO
- Commit consultado: ed86c7d5a5ab21cf5ebb410507a5de04a86663f3 (27-04-2026).
- O esquema é distribuído sob licença MIT; manter atribuição e licença upstream.

## Dados exigidos pelo motor

Cada conta deve fornecer accountId, description, openingDebitBalance, openingCreditBalance, closingDebitBalance, closingCreditBalance e groupingCategory.

Cada movimento deve fornecer transactionDate, transactionId ou entryNumber, sourceId, description, docArchivalNumber, systemEntryDate e linhas. Cada linha deve indicar accountId, debit ou credit, descrição e data/hora real de gravação.

O produtor do software deve fornecer o seu NIF e o número de validação AGT. Quando não aplicável, o XSD permite o valor 0; isto não representa certificação.

## Validação

Instalar xmllint (pacote libxml2-utils em Debian/Ubuntu) e executar:

    node scripts/agt/validate-saft.js caminho/ficheiro.xml

Também é possível indicar um XSD diferente como segundo argumento. O comando termina com código diferente de zero se o XML for inválido ou se xmllint não estiver instalado.

## Integração com Supabase — trabalho seguinte

O motor é independente da base de dados e ainda não consulta directamente o Supabase. Antes de ligar a exportação à empresa real, é necessário criar e testar uma consulta segura por empresa e período que forneça:
- saldos iniciais e finais por conta calculados para o período;
- linhas detalhadas dos lançamentos confirmados;
- utilizador de origem (SourceID), data/hora real de gravação e referência de arquivo;
- código e descrição do diário;
- endereço legal e dados fiscais completos da empresa e do produtor do software.

O snapshot contabilístico existente não fornece todos estes campos nem os saldos históricos de abertura/fecho por período. Não preencher campos em falta com dados inventados nem usar o total global de todos os anos como saldo do exercício. A integração exige uma migração aditiva e verificação do isolamento multiempresa e das permissões. Esta etapa não aplica migrações ao Supabase de produção.

## Limites de conformidade

- A geração XML e a validação XSD não equivalem a homologação/certificação do software nem à submissão electrónica à AGT.
- O SAF-T de contabilidade é distinto da comunicação de facturas/documentos e dos requisitos de assinatura e integração previstos no regime jurídico das facturas.
- Confirmar a versão vigente do diploma, esquema e instruções técnicas da AGT antes de produção.
