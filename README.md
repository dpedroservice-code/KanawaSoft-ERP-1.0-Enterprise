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

O projecto Supabase `mhaynctedpyqjxdhdisv` contém dados existentes e é usado nesta etapa apenas como referência. Os Previews não devem ligar-se a ele nem permitir gravações. A ligação cloud só é activada por configuração de ambiente explícita; a configuração versionada por defeito mantém Supabase desactivado.

## Publicação

O Cloudflare Workers publica a pasta `app/` através de `wrangler.jsonc`. Os Previews são criados com `npx wrangler preview` e usam configuração cloud desactivada por defeito, sem ligação ao Supabase com dados existentes. O workflow de validação não publica em produção.

O domínio `kanawasoft.shop`, o Worker de produção e o DNS permanecem intocados durante esta migração. A publicação de produção exige um processo separado, credenciais de produção configuradas e aprovação explícita.

## Validação e limites

Executar `npm test` e verificações de sintaxe JavaScript antes de integrar. Fazer testes funcionais em browser/Android e com pelo menos duas empresas de teste antes de declarar o ERP pronto para produção. A integração/certificação oficial da AGT não deve ser afirmada sem aprovação formal.
