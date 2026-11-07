# Kanawa Soft ERP 1.0

Aplicação principal e unificada do Kanawa Soft ERP. A página inicial oficial é `app/index.html`; a pasta `app/` contém a interface web, os módulos, os recursos locais e as páginas auxiliares integradas. O ficheiro `index.html` na raiz encaminha para a mesma aplicação, evitando manter uma segunda interface antiga.

## Estrutura central

- `app/index.html`: entrada única, apresentação inicial, selecção de pacote, autenticação, configuração da empresa e área de trabalho.
- `app/app.js`: lógica principal, navegação e módulos empresariais.
- `app/cloud.js`: autenticação e ligação à base de dados central Supabase.
- `app/fatura-modelos.js`: modelos de documentos e facturação.
- `app/integracoes.html` e `app/conformidade.html`: páginas auxiliares ligadas a partir dos respectivos módulos.
- `supabase/migrations/` e `supabase/functions/`: estrutura de dados, segurança e serviços backend.
- `server/` e `desktop/`: execução local/desktop e servidor incorporado.
- `tests/`: testes automatizados.

## Versão do produto

A versão apresentada ao utilizador e a versão do pacote são **1.0**. Identificadores internos antigos da base de dados local foram preservados para evitar perder ou deixar inacessíveis dados locais já existentes; não representam a versão comercial do produto.

## Base de dados central

A versão cloud utiliza Supabase Auth e PostgreSQL. O browser utiliza apenas a chave pública (publishable/anon). Nunca colocar service-role keys, secret keys, JWT secrets ou credenciais privadas no código público.

O projecto Supabase isolado associado a esta entrega é `mhaynctedpyqjxdhdisv`. As migrações e funções devem ser mantidas sincronizadas com esse projecto. Antes de uso real, validar contas, isolamento entre empresas, licenças, limites, documentos, stock e fluxos de RH.

## Publicação

O Netlify publica a pasta `app/`, conforme `netlify.toml`. A publicação automática depende de configurar futuramente o segredo `NETLIFY_AUTH_TOKEN` em GitHub → Settings → Secrets and variables → Actions. Não é necessário fornecer esse token para consolidar o código no repositório.

O domínio de produção `kanawasoft.shop` e o projecto Netlify existente não devem ser alterados durante esta consolidação. Não efectuar deploy de produção nem alterar DNS como parte desta tarefa.

## Validação e limites

Executar `npm test` e verificações de sintaxe JavaScript antes de integrar. Fazer testes funcionais em browser/Android e com pelo menos duas empresas de teste antes de declarar o ERP pronto para produção. A integração/certificação oficial da AGT não deve ser afirmada sem aprovação formal.
