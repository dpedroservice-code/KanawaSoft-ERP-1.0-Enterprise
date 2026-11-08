# KanawaSoft 1.0 — Supabase isolado

## Projeto atribuído

- Projeto: `kanawasoft-1-0-isolated`
- Project ref: `mhaynctedpyqjxdhdisv`
- Região: `eu-west-1`
- API URL: `https://mhaynctedpyqjxdhdisv.supabase.co`
- Repositório activo de integração: `dpedroservice-code/KanawaSoft-ERP-1.0-Enterprise`
- Branch activo: `integrate/kanawasoft-all-requests-2026-11-08`
- Os nomes `dpedroservice-code/KanawaSoft-1.0` e `feat/isolated-supabase-foundation` abaixo são referências históricas da primeira configuração; não são o repositório/branch a editar agora.

Este projeto é exclusivo deste repositório. Não reutilizar o projeto Supabase `APP` nem qualquer credencial de outro ERP/repositório. A publishable key pode ser usada no browser com RLS; nunca expor service-role keys, secret keys, passwords ou tokens de fornecedor.

## Estrutura criada

A migração inicial criou tabelas de empresas, perfis, associações, administradores de plataforma, filiais, registos JSONB por módulo, produtos, planos, licenças, instalações, uso diário, taxas de câmbio, regras fiscais, pedidos de demonstração, vendas e linhas de venda. RLS foi ativado e as operações principais são verificadas por associação à empresa.

## Autenticação

O fluxo de email OTP mantém `shouldCreateUser: false`. O fluxo SMS usa telefone E.164 (por exemplo, `+244923000000`) e `type: sms`. A área **Configurações → Acesso por SMS** permite iniciar a associação do telefone com `auth.updateUser({ phone })` e confirmar o código com `verifyOtp({ type: 'phone_change' })`. Só depois da confirmação o número passa a estar associado à conta Auth para o login SMS.

Para o SMS funcionar em produção, é necessário:
1. Ativar Phone Auth no Supabase Auth.
2. Configurar um fornecedor SMS suportado e as respetivas credenciais diretamente no painel Supabase.
3. Confirmar o telefone na área Configurações → Acesso por SMS.
4. Testar envio, reenvio, código expirado, número inválido e login em dispositivo diferente.

O telefone guardado nos metadados da empresa/perfil não é, por si só, um telefone Auth verificado. Não guardar segredos do fornecedor no GitHub, no browser ou em mensagens de chat.


## Utilizadores, memberships e convites cloud

A gestão da equipa foi portada para o banco dedicado, sem reutilizar a versão antiga que guardava senhas no IndexedDB:

- `ks_company_memberships` é a fonte de verdade para papel e estado do membro.
- `ks_profiles` guarda nome, email e telefone do perfil.
- `ks_team_invitations` guarda convites por empresa; o banco armazena apenas o hash SHA-256 do código.
- O código de convite é mostrado uma única vez ao administrador, tem validade de 72 horas e só pode ser resgatado uma vez pelo email correspondente.
- O colaborador cria a própria senha no Supabase Auth e confirma o email; só depois a membership passa de `invited` para `active`.
- O proprietário e os administradores ficam protegidos. A UI não permite conceder owner/admin por convite ou por alteração direta de papel.
- A coleção IndexedDB `usuarios` permanece apenas como cache da sessão atual; não é fonte de verdade e não deve guardar senhas.

Os perfis disponíveis nesta primeira etapa são gerente, operador e caixa. A gestão avançada de papéis/permissões customizadas fica para uma etapa posterior, após testes funcionais multiempresa.

A migração `20261106162000_cloud_team_invitations_and_membership_management` e o hardening `20261106163000_reduce_team_rpc_definer_surface` foram aplicados ao projeto dedicado e registados no histórico remoto. O projeto dedicado passou a ter 17 tabelas públicas com RLS. Os dois RPCs de equipa executam como SECURITY INVOKER sob RLS. Permanecem três avisos de segurança para RPCs SECURITY DEFINER de venda, sincronização de produtos e consulta de licenças; estas funções exigem revisão adicional. Não declarar o linter de segurança sem avisos.

## Segurança e publicação

A branch ainda requer revisão e testes funcionais completos antes de merge. Não publicar no domínio `kanawasoft.shop` nem alterar o site Netlify de produção durante esta etapa. O projeto antigo permanece intocado.


## Estado do cliente desktop e armazenamento local

A pasta `app/` usa a ponte `app/cloud.js` para autenticação e persistência remota no Supabase. O servidor HTTP embutido do Electron foi alterado para **não inicializar `server/database.js` nem criar/abrir `kanawa.db`**. As antigas rotas CRUD SQLite permanecem bloqueadas com HTTP 410; o servidor local serve a interface e endpoints técnicos de saúde/versão.

O código legado `server/database.js`, a dependência `sql.js` e os ficheiros de dados que já existam nos computadores foram preservados. Não são carregados nem apagados automaticamente. Esta preservação é intencional: permite preparar uma ferramenta de exportação/migração e recuperar dados antigos sem os destruir. Não significa que o SQLite continue a ser a base ativa do novo runtime.

**Mapa técnico do armazenamento encontrado na branch:**
- O renderer cria uma base IndexedDB `kanawa_erp_v15` com **143 stores**. Este é o cache local/offline e continua a ser usado como camada de leitura/escrita pelo ecrã.
- Para os stores que não são locais, `getData/saveData/deleteData` sincronizam com `ks_records` no Supabase; produtos também são espelhados em `ks_products` e vendas finalizadas passam por `ks_finalize_sale`.
- A ponte marca **13 stores como locais**: `empresas`, `usuarios`, `config`, `dispositivos`, `sessoes`, `tentativasLogin`, `politicasSenha`, `sms2FA`, `acessos`, `logsSeguranca`, `seguranca`, `migracoes` e `_sync_queue`. `empresas` tem uma atualização remota especial via `updateCompany`, mas a leitura ainda depende do cache IndexedDB. `_sync_queue` é uma fila local de sincronização; `dispositivos` também contém configuração de hardware.
- Os outros **130 stores** usam sincronização genérica por empresa em `ks_records`. Isso não equivale a 130 tabelas relacionais específicas: os registos são guardados como payload JSONB, com normalização adicional para produtos e vendas.

**Limites ainda por resolver antes de declarar 100% cloud-only:**
- A ponte `app/cloud.js` ainda classifica `empresas`, `usuarios`, `config`, `dispositivos`, `sessoes`, dados de segurança e `_sync_queue` como stores locais. É necessário rever cada leitura/escrita correspondente no renderer e migrar os dados empresariais que devem sincronizar entre dispositivos.
- Não foi disponibilizado um ficheiro real `kanawa.db` de instalação para inventário, exportação, contagem de registos ou reconciliação. Portanto, ainda não foi feita migração de dados de utilizadores.
- Impressoras, gaveta de dinheiro, seleção de ficheiros e backups locais continuam a ser capacidades nativas do Electron; não devem ser confundidas com armazenamento empresarial.
- A dependência e o módulo SQLite só devem ser removidos depois de existir exportador validado, reconciliação de dados e confirmação de que nenhum fluxo legado os utiliza.

A mudança nesta etapa elimina a inicialização silenciosa do SQLite em cada arranque do desktop, sem tocar nos ficheiros locais existentes. O próximo marco é migrar e testar os stores locais de negócio para as tabelas/RPCs Supabase, com backup e reconciliação antes de qualquer remoção definitiva.

## Histórico de migrações

Os ficheiros em `supabase/migrations/` foram alinhados com as versões registadas no projeto remoto. A migração de catálogo restringe escrita de produtos a owner/admin/manager; os restantes membros da empresa podem consultar o catálogo. O fluxo de vendas usa a função transacional para validar e debitar stock.


## SAF-T (AO) — estado da integração (08-11-2026)

- O projecto isolado recebeu a migração `agt_saft_accounting_export` (versão remota `20261108184341`).
- O RPC `public.ks_accounting_saft_snapshot(uuid,date,date)` está criado; verifica a permissão `contabilidade/exportar` e limita os dados à empresa pedida.
- A função Edge `agt-saft-accounting-export` está activa com JWT obrigatório.
- A função usa os metadados padrão do produtor (NIF `5001588150`), ProductID `Kanawa Soft/D.PEDRO SOLUÇÕES LDA` e versão `1.0.0`; podem ser substituídos por Edge Function Secrets.
- O projecto não foi certificado/homologado pela AGT. O número de validação `0` é apenas um marcador pré-certificação.
