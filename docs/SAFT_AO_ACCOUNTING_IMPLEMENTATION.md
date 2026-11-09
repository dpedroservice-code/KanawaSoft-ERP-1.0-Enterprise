# SAF-T (AO) — exportação de contabilidade

## Âmbito

O Kanawa Soft inclui um motor de geração do ficheiro de contabilidade SAF-T (AO), versão 1.01_01, validado contra o XSD incluído em \`schemas/agt/SAFTAO1.01_01.xsd\`.

O ficheiro gerado usa \`TaxAccountingBasis=C\` e inclui:
- cabeçalho da empresa e período fiscal;
- plano de contas completo, incluindo contas integradoras;
- saldos de abertura e encerramento por conta;
- movimentos contabilísticos confirmados e respectivas linhas;
- identificador do utilizador, número de arquivo e data/hora de gravação.

## Ligação Supabase

A exportação usa a função Edge \`agt-saft-accounting-export\` e o RPC \`ks_accounting_saft_snapshot\`.

O RPC:
- exige a permissão \`contabilidade/exportar\`;
- limita todas as consultas ao \`company_id\` indicado;
- considera apenas lançamentos com estado \`posted\`;
- calcula os saldos de abertura antes da data inicial e os saldos de fecho até à data final;
- usa a data/hora \`created_at\` convertida para \`Africa/Luanda\`;
- não exporta lançamentos antigos sem código de utilizador SAF-T;
- bloqueia contas sem conta agregadora activa.

Os novos lançamentos passam a guardar o UUID do autor e um código SAF-T estável de até 30 caracteres, sem expor email ou telefone.

## Classificação de contas

A exportação usa a hierarquia do plano de contas:
- classes diferentes de 9: GR (1.º grau), GA (agregadora) ou GM (movimento);
- classe PGC 9: AR (1.º grau analítica), AA (agregadora analítica) ou AM (movimento analítico).

O código da conta agregadora é obtido da relação \`parent_id\`. Todos os códigos de conta têm de respeitar o limite de 20 caracteres do XSD.

## Segredos da Edge Function

Configurar em Supabase Edge Function Secrets, nunca no GitHub ou no browser:

- \`AGT_SOFTWARE_PRODUCER_TAX_ID\`: NIF da entidade produtora do software.
- \`AGT_SOFTWARE_PRODUCT_ID\`: formato \`Nome do software/Nome da entidade produtora\`.
- \`AGT_SOFTWARE_VERSION\`: versão comercial do produto.
- \`AGT_SOFTWARE_VALIDATION_NUMBER\`: opcional enquanto não existir validação oficial; o valor usado por omissão é \`0\`.

A falta dos três primeiros segredos bloqueia a exportação. O número \`0\` não representa certificação nem homologação.

## Validação local/CI

Instalar \`xmllint\` (pacote \`libxml2-utils\` em Debian/Ubuntu) e executar:

    node scripts/agt/validate-saft.js caminho/ficheiro.xml

O CI executa testes do motor e valida o XML de referência contra o XSD.

## Limites de conformidade

- Esta etapa exporta apenas SAF-T (AO) de contabilidade (\`TaxAccountingBasis=C\`); não inclui facturas, recibos, pagamentos nem outros documentos comerciais.
- Não existe submissão automática à AGT nesta etapa.
- O XML e a validação XSD não equivalem a homologação/certificação do software.
- O número de validação \`0\` identifica o estado pré-certificação.
- O endereço legal e o registo comercial têm de estar preenchidos no perfil legal da empresa.
- Lançamentos históricos sem utilizador de origem não são atribuídos a uma pessoa por suposição; devem ser revistos antes da exportação.

## Esquema e atribuição

- XSD: \`schemas/agt/SAFTAO1.01_01.xsd\`.
- Fonte upstream: https://github.com/assoft-portugal/SAF-T-AO
- Commit de origem documentado: \`ed86c7d5a5ab21cf5ebb410507a5de04a86663f3\`.
- Licença MIT e atribuição: \`docs/SAFT_AO_ASSOFT_LICENSE.md\`.

## Estado da implantação

O código, a migração e a função Edge estão no branch de integração. A migração e a função ainda não foram aplicadas/deployadas no projecto remoto, porque a ligação de Supabase encontrada precisa de confirmação do destino correcto. O projecto \`kanawasoft-1-0-isolated\` está activo, mas a documentação do repositório associa-o a um repositório anterior diferente; o projecto \`APP\` é outro projecto e não deve ser reutilizado sem confirmação.
