# Fase F0 — Checklist de auditoria técnica e fundação

**Objectivo:** verificar, sem alterar dados ou esquema, se a implementação actual do Kanawa Soft ERP está alinhada com a Matriz Técnica Enterprise.

**Âmbito desta entrega:** documentação e consultas SQL estritamente de leitura. Não executar migrations, não alterar políticas, funções, tabelas, dados, domínio ou produção nesta fase.

## 1. Regras de execução

- Executar primeiro em ambiente isolado/staging, com credenciais de leitura sempre que possível.
- Não partilhar chaves `service_role`, passwords, tokens ou dados pessoais nos relatórios.
- Guardar apenas contagens, nomes técnicos, estados e evidências mínimas.
- Uma tabela sem coluna literal `company_id` não é automaticamente vulnerável: verificar chaves de tenant equivalentes, relações e políticas efectivas.
- RLS activo não prova isolamento correcto. Inspeccionar políticas, funções SECURITY DEFINER, grants e caminhos de escrita.
- Comparar migrations versionadas com o ledger real; não aplicar automaticamente migrations em falta.
- Nunca executar comandos de escrita incluídos em exemplos de correcção durante a auditoria.

## 2. Checklist por frente

### F0.1 — Supabase, multi-tenant e RLS

- [ ] Inventariar tabelas, views, materialized views e schemas relevantes.
- [ ] Identificar tabelas operacionais e respectiva chave de tenant (`company_id` ou equivalente).
- [ ] Confirmar RLS activo e FORCE ROW LEVEL SECURITY quando apropriado.
- [ ] Inventariar políticas por tabela, operação, role e expressão USING/WITH CHECK.
- [ ] Identificar tabelas sem política, políticas demasiado permissivas e acesso anon.
- [ ] Inspeccionar grants em tabelas, sequences, views e funções.
- [ ] Inspeccionar funções SECURITY DEFINER: owner, search_path, EXECUTE grants e validação explícita do tenant.
- [ ] Inventariar FKs, índices de suporte e relações sem integridade referencial.
- [ ] Verificar triggers de imutabilidade/auditoria em documentos fiscais e cadastros referenciados.
- [ ] Testar isolamento com duas empresas de teste e utilizadores distintos, sem dados reais.

**Evidências:** inventário de tabelas, mapa RLS/policies, grants, funções privilegiadas, FKs/índices e resultados de testes cross-tenant.

### F0.2 — Migrations e ledger fiscal

- [ ] Listar migrations presentes no repositório e respectivas versões.
- [ ] Ler o ledger de migrations real da instância, identificando a tabela efectivamente usada pela ferramenta.
- [ ] Comparar versões locais e aplicadas: aplicadas, em falta, divergentes e duplicadas.
- [ ] Confirmar estrutura e constraints de `ks_fiscal_documents` e tabelas relacionadas.
- [ ] Inspeccionar séries, sequências, unicidade, concorrência e prevenção de duplicação de numeração.
- [ ] Verificar ligação entre documento fiscal, assinatura/hash, estado, empresa e documento correctivo.
- [ ] Confirmar que documentos emitidos não podem ser editados/apagados por operações normais.
- [ ] Verificar se correcções são feitas por fluxo formal e auditável.

**Evidências:** tabela de reconciliação de migrations, descrição do ledger fiscal, constraints e fluxos de numeração.

### F0.3 — Permissões, RPCs e segregação SaaS

- [ ] Mapear IDs dos módulos M01–M19 para menu, rotas, componentes e permissões existentes.
- [ ] Inventariar RPCs, Edge Functions e endpoints de escrita/leitura.
- [ ] Confirmar validação server-side de tenant, membership, papel, permissão e estado da licença.
- [ ] Verificar acções granulares: read, create, update, delete, approve, cancel, export, manage e admin.
- [ ] Confirmar que esconder botões no frontend não é a única barreira de segurança.
- [ ] Verificar que administradores de tenant não acedem a planos globais, licenças, emissão de chaves ou aprovação de pagamentos SaaS.
- [ ] Confirmar que funções administrativas da plataforma exigem identidade/role de plataforma, sem confiar em metadata editável pelo cliente.
- [ ] Rever logs append-only e trilhos de auditoria para acções privilegiadas.

**Evidências:** mapa módulo→rota→permissão→endpoint, matriz de RPCs, resultados de testes negativos e positivos.

### F0.4 — Planos, entitlements e expiração

- [ ] Exportar catálogo actual de planos e termos, sem alterar preços.
- [ ] Mapear cada feature_key proposta para uma capacidade concreta e critérios de utilização.
- [ ] Identificar limites por plano (utilizadores, empresas/filiais, armazéns, volume ou outros).
- [ ] Verificar onde o entitlement é calculado e confirmar validação no servidor.
- [ ] Testar licença activa, trial, pagamento pendente, período de tolerância, expirada, suspensa e cancelada.
- [ ] Confirmar que downgrade/expiração bloqueia novas operações premium conforme política, sem apagar dados.
- [ ] Confirmar acesso de consulta/exportação e procedimento de reactivação.
- [ ] Não alterar o catálogo comercial Mini 15.000 Kz, Standard 35.000 Kz e Premium 75.000 Kz durante a auditoria.

**Evidências:** matriz plano→feature→limite→regra de expiração e resultados de testes.

### F0.5 — Navegação, rotas e compatibilidade offline

- [ ] Inventariar árvore de menu, IDs, rotas, componentes e renderers actuais.
- [ ] Produzir mapa De-Para para Categoria→Módulo→Submódulo, com máximo de três níveis.
- [ ] Identificar IDs persistidos em preferências, bookmarks, permissões ou dados.
- [ ] Inventariar as stores IndexedDB efectivamente existentes (incluindo a alegação de 146 stores, a confirmar).
- [ ] Mapear filas offline, chaves, versões de schema, operações pendentes e mecanismos de retry.
- [ ] Confirmar idempotência e prevenção de duplicação na sincronização.
- [ ] Não renomear nem remover stores, chaves ou rotas nesta fase.
- [ ] Definir testes de regressão para PDV offline antes de qualquer alteração de navegação.

**Evidências:** mapa de rotas, inventário real de IndexedDB, dependências e plano de regressão.

## 3. Estados de auditoria

Usar exclusivamente estes estados:
- **Conforme:** evidência verificável e teste aprovado.
- **Parcial:** existe implementação, mas falta cobertura ou evidência.
- **Não conforme:** falha reproduzível ou controlo ausente.
- **Não verificado:** ainda sem evidência suficiente.
- **Não aplicável:** justificação documentada.

Cada achado deve conter: ID, severidade, componente, evidência, risco, passos de reprodução, recomendação, responsável e estado. Não marcar como conforme com base apenas na existência de uma tabela, função ou botão.

## 4. Severidade e critérios de bloqueio

- **Crítica:** acesso cross-tenant, bypass de licença/admin, exposição de segredos, alteração indevida de documentos fiscais ou perda/corrupção de dados. Bloqueia publicação.
- **Alta:** autorização server-side ausente, falha de integridade financeira/fiscal, duplicação de operações ou quebra de sincronização com impacto material. Bloqueia publicação até mitigação.
- **Média:** inconsistência funcional ou controlo incompleto sem exposição imediata demonstrada.
- **Baixa:** melhoria de desempenho, usabilidade ou documentação.

## 5. Entregáveis da F0

1. Relatório de auditoria com evidências e severidades.
2. Reconciliação migrations local vs. Supabase.
3. Matriz de RLS, tabelas, funções e grants.
4. Matriz M01–M19: menu, rota, endpoint, permissão e entitlement.
5. Catálogo proposto de feature_keys reconciliado com planos reais.
6. Inventário IndexedDB e plano de compatibilidade.
7. Plano de correcção priorizado, cada correcção em alteração isolada e com testes.

## 6. Critério de saída da F0

A F0 só termina quando todos os achados críticos/altos estiverem resolvidos e retestados, as diferenças de migrations estiverem explicadas, o isolamento multiempresa estiver demonstrado por testes negativos, os limites SaaS estiverem verificados no servidor e a compatibilidade offline estiver documentada.

**Aprovação para a fase seguinte:** revisão explícita do relatório e autorização separada para cada alteração de código, migration ou configuração. A auditoria, por si só, não autoriza deploy nem alteração do Supabase.
