# Autenticação OTP e edição — Kanawa Soft ERP

## Fluxo de autenticação

1. O acesso por Gmail/SMS exige código de utilização única de seis dígitos; a alternativa por palavra-passe foi retirada do formulário normal de login.
2. O login existente usa Supabase Auth `signInWithOtp` e valida o código com `verifyOtp`.
3. O primeiro registo usa o tipo `signup`: a aplicação solicita reenvio de confirmação com `auth.resend({ type: 'signup' })` e valida com `verifyOtp({ type: 'signup' })`.
4. O contexto da empresa e as permissões só são carregados depois de o Supabase devolver um utilizador autenticado.
5. O reenvio de código respeita o tipo do fluxo (login ou registo), sem misturar tokens de confirmação.
6. Convites mantêm o fluxo próprio; não se cria um segundo cliente Supabase nem uma sessão paralela.

## Configuração obrigatória no painel Supabase

No projecto Supabase associado ao ERP:

1. **Authentication → Providers → Email**: manter Email activo e confirmar que a confirmação de email está habilitada.
2. **Authentication → Email Templates → Confirm signup**: usar `{{ .Token }}` no corpo da mensagem para apresentar o código de seis dígitos. Não depender apenas de `{{ .ConfirmationURL }}`, que é um link.
3. **Authentication → Email Templates → Magic Link**: quando o template for usado para OTP de login, apresentar também `{{ .Token }}`.
4. **Authentication → Settings**: confirmar comprimento OTP de 6 dígitos e definir expiração curta.
5. Configurar SMTP próprio e remetente verificado; testar entrega, spam e reenvio.
6. Manter CAPTCHA/limites de tentativa quando disponíveis. Nunca colocar service-role key no browser.

A alteração de código não altera templates nem definições do painel. A configuração do Supabase e o teste real de entrega continuam obrigatórios antes de abrir o acesso aos clientes.

## Edição e sincronização dos registos

Os módulos devem usar o pipeline comum existente, sem gravar directamente em Supabase a partir dos formulários:

- A edição carrega o registo pelo ID e chama `saveData(store, record)`.
- `saveData` usa `DB.put` para actualizar e `DB.add` para criar.
- Com sessão cloud, `KanawaCloud.upsertRecord` grava com `company_id`, `store_key` e `record_id`.
- Offline, a alteração entra na fila e é sincronizada quando a ligação regressa.
- RLS e permissões continuam autoritativos; o formulário não concede acesso.
- Vendas finalizadas permanecem imutáveis; rectificações seguem o fluxo de Nota de Crédito.

## Testes de aceitação

- Registo novo com OTP signup, reenvio e rejeição de código errado/expirado.
- Login Gmail e SMS com OTP obrigatório.
- Editar produto, cliente e categoria; confirmar após recarregar.
- Editar offline e confirmar sincronização sem duplicação.
- Verificar isolamento entre empresas e permissões por perfil.
- Confirmar que vendas finalizadas não podem ser sobrescritas.

Não aplicar migrações Supabase nem publicar em produção nesta etapa.
