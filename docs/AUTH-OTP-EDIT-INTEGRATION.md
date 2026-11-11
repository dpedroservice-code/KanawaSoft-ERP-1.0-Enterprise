# Autenticação por código OTP — Kanawa Soft ERP

## Fluxo implementado

1. O utilizador introduz o Gmail no ecrã de acesso.
2. A aplicação solicita um código de utilização única através de Supabase Auth.
3. O utilizador introduz os seis dígitos recebidos.
4. A aplicação valida o código com `verifyOtp` e só depois carrega o contexto da empresa e as permissões.
5. O botão de reenvio usa o mesmo canal e não cria uma segunda conta.
6. No primeiro registo, o Supabase envia a confirmação do tipo `signup`; a aplicação valida esse código com `verifyOtp({ type: 'signup' })` antes de activar a sessão.
7. Convites e sessões existentes continuam a passar pelas suas validações próprias.

O acesso por Gmail passa a exigir OTP. O fluxo de palavra-passe deixa de ser um caminho alternativo no formulário normal de login. O canal SMS mantém a validação OTP existente.

## Configuração necessária no Supabase

No projecto associado ao Kanawa Soft:

1. Abrir **Authentication → Providers → Email** e confirmar que o fornecedor Email está activo e que a confirmação de email está habilitada.
2. Em **Authentication → Email Templates → Confirm signup**, configurar o corpo para apresentar o token de seis dígitos usando `{{ .Token }}`. Não usar apenas `{{ .ConfirmationURL }}`, porque isso envia um link em vez do código que o formulário espera.
3. Em **Authentication → Email Templates → Magic Link**, se esse template for usado pelo fornecedor para OTP de acesso, também apresentar `{{ .Token }}` e não depender exclusivamente de `{{ .ConfirmationURL }}`.
4. Em **Authentication → Settings**, confirmar o comprimento OTP de 6 dígitos e definir uma expiração curta adequada à política de segurança.
5. Configurar SMTP próprio e remetente verificado para entrega fiável. Testar Gmail, spam e reenvio.
6. Manter CAPTCHA/rate limiting do Auth quando disponível. Nunca expor service-role key no browser.

> A alteração do código não altera automaticamente os templates nem as definições do painel Supabase. Esta configuração de painel e o teste de entrega real são passos operacionais obrigatórios antes de activar a experiência para clientes.

## Edição e sincronização dos registos

A edição dos módulos deve continuar a usar o pipeline comum existente:

- Formulários de edição carregam o registo por ID e chamam `saveData(store, record)`.
- `saveData` usa `DB.put` para registos existentes e `DB.add` para novos.
- Com sessão cloud activa, `KanawaCloud.upsertRecord` grava em `ks_records`, sempre com `company_id`, `store_key` e `record_id`.
- Sem ligação, a alteração fica na fila de sincronização e é repetida quando a ligação regressa.
- O RLS e as permissões existentes continuam a ser a autoridade; o estado visual do formulário não concede permissões.
- Vendas finalizadas permanecem imutáveis; rectificações devem seguir o fluxo próprio de Nota de Crédito.

Não criar um segundo cliente Supabase, outro armazenamento paralelo, nem gravar directamente em tabelas cloud a partir dos formulários. Isso evita divergência entre edição local, sincronização, auditoria e dados multiempresa.

## Testes antes de produção

- Registo novo com OTP signup de seis dígitos.
- Reenvio de código de registo e rejeição de código expirado/incorreto.
- Login normal com OTP e reenvio.
- Troca de empresa/utilizador e confirmação de isolamento dos registos.
- Editar e guardar produto, cliente e categoria; confirmar persistência após actualizar a página.
- Editar offline, voltar online e confirmar sincronização única.
- Confirmar que um operador não consegue editar módulos sem permissão.
- Confirmar que uma venda finalizada não pode ser sobrescrita.

Não aplicar migrações Supabase nem publicar em produção como parte desta etapa.
