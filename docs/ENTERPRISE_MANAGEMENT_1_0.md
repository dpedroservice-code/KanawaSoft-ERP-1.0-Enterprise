# Kanawa Soft ERP 1.0 — Enterprise Management Foundation

## Escopo desta entrega

A branch `feat/erp-integrations-foundation` amplia a base isolada do Kanawa Soft 1.0 sem alterar o domínio de produção, a branch `main` ou o projecto Supabase legado.

### Departamentos e módulos
- Empresa e documentos legais: natureza jurídica, matrícula, verbete, certidão, publicação online GUE, alvarás/licenças, INSS, sócios e representantes, anexos privados e alertas de validade.
- RH: trabalhadores, admissão, BI/NIF, contrato, salário, bónus, subsídios, histórico de remuneração, documentos e validade.
- Férias, licenças e dispensas: pedidos, aprovações e estimativa inicial de direito anual.
- Folha salarial: bruto, IRT conforme tabela configurada, INSS trabalhador e empregador; validação humana antes de pagamento/declaração.
- Finanças: despesas gerais, centros de custo, orçamento e aprovação.
- Agenda: marcações, prazos e eventos; reuniões com pauta, local/link e participantes.
- Comunicação interna: mensagens e partilha privada de ficheiros.
- Indústria: centros de trabalho, roteiros de produção e planos de manutenção, além dos módulos de MRP/BOM/qualidade já existentes.
- Licença SaaS: pacote, duração 1/12/24/36 meses, comprovativo, chave de activação, quota mensal de facturas e bloqueio server-side após expiração ou limite.

### Estrutura da base de dados
- 17 tabelas da fundação inicial.
- 45 tabelas da camada operacional anterior.
- 3 tabelas de legislação/conformidade.
- 28 tabelas da camada empresarial/licenciamento.
- Total previsto após todas as migrações: **93 tabelas públicas** (sem contar views, índices, funções e tabelas internas de Storage/Auth).

### Pacotes iniciais configuráveis (valores de proposta, não publicados como contrato)
| Pacote | Preço mensal proposto | Utilizadores | Facturas/mês |
|---|---:|---:|---:|
| Mini | 15.000 Kz | 3 | 500 |
| Standard | 35.000 Kz | 10 | 2.500 |
| Premium | 75.000 Kz | 30 | 10.000 |
| Enterprise | Sob consulta | 100 base | 50.000 base |

A licença aceita períodos de 1, 12, 24 ou 36 meses. A quota é mensal e renova no início de cada mês; o preço de multi-ano está calculado pelo preço mensal multiplicado pelo prazo, sem desconto automático nesta versão. Preços e limites devem ser aprovados pela D.PEDRO SOLUÇÕES antes de venda.

### Segurança e operação
- Dados de empresa isolados por `company_id` e RLS.
- Documentos empresariais, RH e comprovativos guardados em buckets privados.
- Documentos e salários são restritos a owner/admin/manager; pedidos de férias podem ser consultados pelo próprio requerente.
- Chaves de licença são emitidas apenas por administrador da plataforma, devolvidas uma vez e armazenadas como SHA-256.
- A função de finalização de venda/factura valida licença, validade e quota antes de baixar stock e gravar a venda.
- Após expiração, consulta e exportação continuam possíveis; a emissão de novas facturas é bloqueada.
- Meta/WhatsApp continuam apenas preparados para guardar credenciais cifradas; não se activam campanhas ou envio de mensagens nesta fase.

## Legislação e alertas
A biblioteca legal é um registo inicial de referências e não um parecer jurídico. A publicação de actos societários é referenciada pelo GUE online. A empresa deve preencher datas, referências e anexar os seus documentos reais. Os alertas são calculados a 90, 60, 30, 15 e 7 dias; a notificação por email/WhatsApp exige configuração de um serviço de envio separado.

## Limites que continuam pendentes
- Rever juridicamente a minuta de termos e privacidade e confirmar a legislação fiscal/laboral consolidada.
- Validar a tabela IRT vigente e regimes especiais.
- Confirmar o enquadramento de cada tipo de licença/alvará e regras sectoriais.
- Testar duas empresas sintéticas para RLS, armazenamento e isolamento.
- Testar aprovação de pagamentos e entrega de chave.
- Testar mobile/desktop e o fluxo de primeiro acesso.
- O vídeo promocional final ainda precisa de um ficheiro oficial; a página já tem uma ilustração animada CSS de apresentação.

## Aplicação
O Netlify publica a pasta `app/`. O preview desta branch deve ser um deploy de pré-visualização, nunca produção. A publicação de produção continua dependente de merge aprovado para `main`.


## Auditoria de segurança e performance no Supabase isolado
- 93/93 tabelas públicas com RLS activado.
- Advisor de segurança: zero findings.
- Advisor de performance: zero FKs sem índice e zero políticas permissivas duplicadas.
- Permanecem 163 avisos INFO de índices ainda não utilizados, esperados porque o ambiente de validação ainda não tem carga de negócio real; rever após dados e tráfego.
- A chave AES-256-GCM foi gerada no servidor e guardada no Supabase Vault. O RPC de leitura é executável apenas por `service_role`.
- As funções privilegiadas foram movidas para o schema privado, com wrappers públicos SECURITY INVOKER.

## Migrações
A expansão foi aplicada em 17 migrações no projecto isolado. As últimas três fazem varrimento de índices de FKs e consolidam políticas RLS herdadas. Não aplicar estas migrações manualmente novamente num ambiente que já as tenha registado.
