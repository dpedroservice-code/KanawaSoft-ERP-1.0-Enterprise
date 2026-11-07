# Kanawa Soft ERP 1.0 — Faturação, propostas e manutenção

## Faturação configurável
- Três apresentações HTML/CSS: clássica, moderna e minimalista.
- Os valores impressos vêm do registo de venda e do cadastro da empresa; o modelo controla apenas a apresentação.
- Dados da empresa apresentados: razão social/nome comercial, NIF, morada, telefone, email e website.
- Banco e IBAN são opcionais e controlados pela configuração da empresa.
- Termos comerciais próprios podem ser definidos em Configurações.
- Cor principal, cor secundária e modelo podem ser personalizados.
- Preferências de faturação são guardadas no registo da empresa através da coleção sincronizada `configuracoesFatura`, com cache local.
- Identidade comercial e bancária da empresa (morada, NIF, telefone, email, website, banco e IBAN) sincroniza por empresa através de `empresaConfig`. O logótipo em base64 continua local neste momento e precisa de upload privado para ficar disponível em todos os dispositivos.
- QR é opcional e contém apenas dados de referência do documento. Não é QR de validação fiscal.
- Não são impressos termos, hash, assinatura ou declarações de certificação AGT enquanto não existir integração fiscal activa e confirmada no servidor.
- Não foram incorporados templates ou imagens de terceiros; os layouts do ERP são originais e editáveis no repositório.

## Propostas e conversão em compra
- Os orçamentos passam a representar propostas comerciais com empresa cliente, responsável, data de envio, estado e histórico.
- Estados disponíveis: rascunho, enviada, aceite, perdida e convertida.
- Ao converter uma proposta no PDV e concluir a venda, o registo da proposta fica ligado à venda correspondente.

## Manutenção e intervenções
- Cada ordem pode registar empresa cliente, equipamento/activo, tipo de manutenção, técnico, datas agendada e próxima, custo, prioridade, descrição e materiais.
- A conclusão regista data, técnico, relatório e histórico de eventos.
- O técnico pode ser escolhido a partir dos funcionários cadastrados; o nome também pode ser preenchido quando o técnico é externo.

## Limitações ainda abertas
- A configuração de faturação sincroniza por empresa, mas a validação funcional em duas empresas e em dois dispositivos ainda é necessária.
- A numeração oficial é reservada atomicamente no servidor por empresa e ano fiscal. Se a empresa estiver offline, o ERP não emite uma fatura final numerada; continua possível guardar a proposta/rascunho e finalizar depois de restabelecer a ligação.
- A interface de impressão A4 foi modernizada; a versão térmica ainda precisa de alinhamento com os novos modelos.
- O estado de integração AGT tem de ser obtido por confirmação server-side antes de apresentar elementos fiscais.
- A interface de manutenção ainda precisa de validação de fluxo com técnicos internos e prestadores externos.
- Os módulos CRM/propostas e manutenção usam os registos genéricos existentes; relatórios e permissões granulares por equipa ainda precisam de testes.

## Segurança e publicação
- A branch continua isolada em `feat/erp-integrations-preview`.
- Não fazer merge para `main` nem deploy de produção sem aprovação expressa.
- O CI da PR deve passar os testes automatizados e a verificação de sintaxe.

## Licenças e controlo do proprietário
- Pacotes pagos Mini, Standard, Premium e Enterprise foram configurados sem limite de utilizadores, instalações ou facturas; o período de avaliação de 14 dias mantém limites próprios.
- A emissão de chaves e a consulta de pedidos de pagamento dependem de uma única conta proprietária registada no schema privado.
- A identidade do proprietário ainda não foi registada: a tabela privada começa vazia por segurança. Até o UUID da conta proprietária ser confirmado e registado por operação administrativa segura, ninguém pode emitir ou consultar chaves.
- As chaves são devolvidas apenas uma vez na emissão; a base de dados conserva apenas o hash. Não se devem colocar chaves em HTML, logs ou mensagens visíveis a funcionários.

## Adaptação por sector
- As configurações da empresa incluem perfis para comércio, farmácia/saúde, cantina/restauração, serviços técnicos/manutenção, indústria, construção, logística, educação, hotelaria, agricultura e outras actividades.
- O perfil serve como classificação operacional inicial. Os fluxos específicos de cada sector (por exemplo, lotes/validade e rastreabilidade na farmácia ou mesas/receitas na restauração) ainda exigem módulos e testes próprios antes de serem anunciados como concluídos.
