# POS: idempotência e concorrência de stock

## Objetivo

Evitar que uma repetição de pedido, uma resposta perdida ou dois caixas a venderem simultaneamente provoquem faturas duplicadas ou stock negativo.

## Implementação

- Cada tentativa de finalização do PDV recebe um UUID estável (clientEventId) e uma data local (clientCreatedAt).
- O mesmo objeto de venda pendente mantém o identificador durante as tentativas de repetição.
- O frontend envia o evento para ks_finalize_sale; o PostgreSQL guarda client_event_id, client_created_at e uma impressão digital do conteúdo da venda e das linhas.
- Um índice único parcial em (company_id, client_event_id) impede que o mesmo evento seja registado duas vezes na mesma empresa.
- O índice único já existente em (company_id, external_id) continua a proteger o identificador externo da venda.
- Uma repetição com o mesmo identificador e o mesmo conteúdo devolve o ID da venda original. O pedido não volta a descontar stock nem a consumir quota.
- Se o mesmo identificador for reutilizado com conteúdo diferente, a função rejeita o pedido com IDEMPOTENCY_CONFLICT.
- Em concorrência, a função usa ON CONFLICT DO NOTHING, relê a venda vencedora e valida o conteúdo antes de devolver o resultado.
- A finalização continua a bloquear cada produto com SELECT ... FOR UPDATE, confirmar o stock e descontar a quantidade dentro da mesma transação PostgreSQL. Uma falha em qualquer linha faz rollback de toda a venda.

## Regra de operação offline

O PDV **não emite uma fatura finalizada quando não existe ligação ao servidor**. O número sequencial, a licença, as permissões, a disponibilidade de stock e a gravação fiscal são confirmados no servidor. Não se deve transformar uma venda offline pendente numa fatura fiscal emitida apenas com base no relógio ou no stock local.

A fila offline existente continua adequada para operações que podem ser sincronizadas posteriormente. A finalização fiscal do POS exige ligação e confirmação central. Uma futura funcionalidade de venda offline terá de ser desenhada como documento provisório, com reconciliação explícita, regras de conflito, e enquadramento fiscal validado antes de ser ativada.

## Testes

- Teste transacional no Supabase isolado: duas chamadas com o mesmo evento e o mesmo conteúdo devolveram o mesmo ID; a quantidade de stock foi descontada apenas uma vez; um segundo pedido com o mesmo evento e conteúdo alterado foi rejeitado.
- O teste foi executado dentro de uma transação revertida (ROLLBACK); não deixou venda nem linhas de teste e o stock original permaneceu inalterado.
- CI do repositório: 129 testes aprovados, 0 falhas; verificação de sintaxe JavaScript concluída.
- O teste transacional acima valida repetição e alteração do payload; não equivale a um teste de carga concorrente com múltiplas sessões PostgreSQL.

## Estado e limites

- Migração: 20261108204100_idempotent_pos_sale_confirmation.sql.
- Projeto Supabase de validação: kanawasoft-1-0-isolated; não altera o projeto de produção APP.
- Não foram feitas vendas reais, não foram alterados os registos existentes e não foi feito merge para main.
- A numeração de faturas é atribuída pelo servidor antes da confirmação final. A reserva de números e o tratamento formal de documentos rejeitados/anulados continuam a exigir uma etapa própria de desenho e validação fiscal; não declarar ausência absoluta de lacunas até essa etapa estar concluída.
