/* Kanawa Soft Cloud Bridge — Supabase Auth + PostgreSQL */
(function () {
  'use strict';

  // Fail closed: no environment config means no Supabase connection.
  // Preview builds ship with enabled:false; production credentials are injected only
  // by an explicitly approved production build, never from this source file.
  const cloudConfig = window.KANAWA_SUPABASE_CONFIG || {};
  const SUPABASE_URL = cloudConfig.url || '';
  const SUPABASE_PUBLISHABLE_KEY = cloudConfig.publishableKey || '';
  const cloudEnabled = cloudConfig.enabled === true && !!SUPABASE_URL && !!SUPABASE_PUBLISHABLE_KEY;
  const sdk = window.supabase;
  const client = cloudEnabled && sdk && typeof sdk.createClient === 'function'
    ? sdk.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: { autoRefreshToken: true, persistSession: true, detectSessionInUrl: true }
      })
    : null;

  const LOCAL_ONLY_STORES = new Set([
    'empresas', 'usuarios', 'config', 'dispositivos', 'sessoes',
    'tentativasLogin', 'politicasSenha', 'sms2FA', 'acessos',
    'logsSeguranca', 'seguranca', 'migracoes', '_sync_queue'
  ]);

  let context = null;

  function failIfError(result) {
    if (result && result.error) throw result.error;
    return result ? result.data : null;
  }

  // Recover once from an expired access token before retrying a read.
  // Never sign the user out or discard cached company/user data on a transient JWT expiry.
  async function withFreshAuthRetry(operation) {
    try {
      return await operation();
    } catch (error) {
      const message = String(error && (error.message || error.msg) || error || '');
      const code = String(error && error.code || '');
      const status = Number(error && (error.status || error.statusCode) || 0);
      if (!/jwt expired|token is expired|invalid jwt/i.test(message) &&
          code !== 'PGRST301' && status !== 401) throw error;
      const refreshed = await client.auth.refreshSession();
      if (refreshed.error) throw refreshed.error;
      if (!refreshed.data || !refreshed.data.session || !refreshed.data.user) {
        throw new Error('A sessão expirou. Inicie sessão novamente para continuar.');
      }
      if (context) context.user = refreshed.data.user;
      return await operation();
    }
  }

  function normalizePhoneE164(phone) {
    let normalized = String(phone || '').trim().replace(/[\s().-]/g, '');
    if (/^9\d{8}$/.test(normalized)) normalized = '+244' + normalized;
    else if (/^2449\d{8}$/.test(normalized)) normalized = '+' + normalized;
    if (!/^\+[1-9]\d{7,14}$/.test(normalized)) {
      throw new Error('Introduza um número válido: 9XXXXXXXX, 2449XXXXXXXX ou +2449XXXXXXXX.');
    }
    return normalized;
  }

  function appRole(role) {
    const key = String(role || 'operator').trim().toLowerCase();
    if (key === 'owner' || key === 'admin') return 'admin';
    if (key === 'manager' || key === 'gerente') return 'gerente';
    if (key === 'accountant' || key === 'contabilista') return 'contabilista';
    if (key === 'cashier' || key === 'caixa') return 'caixa';
    return 'operador';
  }

  async function loadContext(user) {
    if (!client || !user) throw new Error('Sessão Kanawa não encontrada.');
    const membershipResult = await client
      .from('ks_company_memberships')
      .select('company_id, role, status, permissions')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    const membership = failIfError(membershipResult);
    if (!membership) {
      const pendingResult=await client.from('ks_company_memberships').select('company_id,status')
        .eq('user_id',user.id).eq('status','pending_approval').limit(1).maybeSingle();
      const pending=failIfError(pendingResult);
      if(pending) throw new Error('Gmail confirmado. A sua conta aguarda activação pelo Administrador da empresa. Contacte o administrador para libertar o acesso.');
      throw new Error('A conta foi autenticada, mas ainda não tem uma empresa ativa. Confirme o email ou contacte o administrador.');
    }

    const company = failIfError(await client
      .from('ks_companies')
      .select('*')
      .eq('id', membership.company_id)
      .single());

    const profile = failIfError(await client
      .from('ks_profiles')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle());

    const platformAdmin = failIfError(await client.rpc('ks_is_platform_admin'));
    const moduleSettings = failIfError(await client.from('ks_company_module_settings')
      .select('module_id,enabled').eq('company_id', membership.company_id)) || [];
    const companyModules = {};
    moduleSettings.forEach(function (row) { companyModules[row.module_id] = row.enabled; });

    context = {
      user: user,
      company: company,
      membership: membership,
      profile: profile || {},
      role: appRole(membership.role),
      companyModules: companyModules,
      isPlatformAdmin: platformAdmin === true,
      platformRole: platformAdmin === true ? 'owner' : null
    };
    try { localStorage.setItem('kanawa_cloud_context', JSON.stringify(context)); } catch (e) { }
    return context;
  }

  const Cloud = {
    client: client,
    get context() { return context; },
    setPreviewContext: function (previewContext) {
      if (!window.KANAWA_PREVIEW_DEMO || !previewContext || previewContext.preview !== true || previewContext.read_only !== true) {
        throw new Error('Contexto de demonstração não autorizado.');
      }
      context = previewContext;
      return context;
    },
    get ready() { return !!(client && context && context.company && context.user); },
    isLocalOnly: function (store) { return LOCAL_ONLY_STORES.has(store); },

    async init() {
      if (!client) return null;
      const result = await client.auth.getSession();
      if (result.error) throw result.error;
      const session = result.data && result.data.session;
      if (!session) return null;
      try { return await loadContext(session.user); }
      catch (networkError) {
        // Permit an already-authenticated installation to open its local cache while offline.
        try {
          const cached = JSON.parse(localStorage.getItem('kanawa_cloud_context') || 'null');
          if (cached && cached.user && cached.user.id === session.user.id && cached.company && cached.company.id) {
            context = cached;
            return context;
          }
        } catch (e) { }
        throw networkError;
      }
    },

    async signInWithPassword(email, password) {
      if (!client) throw new Error('Biblioteca de ligação à base de dados não carregou. Atualize a página.');
      const normalizedEmail=String(email||'').trim().toLowerCase();
      if (!normalizedEmail || !password) throw new Error('Introduza o Gmail e a palavra-passe.');
      const result=await client.auth.signInWithPassword({email:normalizedEmail,password:String(password)});
      if(result.error) {
        if(/email not confirmed/i.test(result.error.message||'')) throw new Error('Confirme primeiro o Gmail através do link enviado para a sua caixa de correio.');
        throw result.error;
      }
      if(!result.data||!result.data.user) throw new Error('Não foi possível iniciar a sessão.');
      return await loadContext(result.data.user);
    },

    async requestOtp(identifier, method) {
      if (!client) throw new Error('Biblioteca de ligação à base de dados não carregou. Atualize a página.');
      const channel = method === 'sms' ? 'sms' : 'email';
      if (channel === 'sms') {
        const phone = this.normalizePhone(identifier);
        const result = await client.auth.signInWithOtp({
          phone,
          options: { shouldCreateUser: false }
        });
        if (result.error) throw result.error;
        return true;
      }
      const normalizedEmail = String(identifier || '').trim().toLowerCase();
      if (!normalizedEmail) throw new Error('Introduza o endereço de email.');
      const result = await client.auth.signInWithOtp({
        email: normalizedEmail,
        options: { shouldCreateUser: false }
      });
      if (result.error) throw result.error;
      return true;
    },

    async verifyOtp(identifier, token, method) {
      if (!client) throw new Error('Biblioteca de ligação à base de dados não carregou. Atualize a página.');
      const channel = method === 'sms' ? 'sms' : 'email';
      const code = String(token || '').replace(/\s/g, '');
      if (!/^\d{6}$/.test(code)) throw new Error('Introduza o código de 6 dígitos recebido.');
      const payload = channel === 'sms'
        ? { phone: this.normalizePhone(identifier), token: code, type: 'sms' }
        : { email: String(identifier || '').trim().toLowerCase(), token: code, type: 'email' };
      const result = await client.auth.verifyOtp(payload);
      if (result.error) throw result.error;
      if (!result.data || !result.data.user) throw new Error('Não foi possível validar o código. Peça um novo código.');
      return await loadContext(result.data.user);
    },

    async requestSignupOtp(email) {
      if (!client) throw new Error('Biblioteca de ligação à base de dados não carregou. Atualize a página.');
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!normalizedEmail) throw new Error('Introduza o email usado no registo.');
      const result = await client.auth.resend({ type: 'signup', email: normalizedEmail });
      if (result.error) throw result.error;
      return true;
    },

    async verifySignupOtp(email, token) {
      if (!client) throw new Error('Biblioteca de ligação à base de dados não carregou. Atualize a página.');
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const code = String(token || '').replace(/\s/g, '');
      if (!normalizedEmail) throw new Error('Introduza o email usado no registo.');
      if (!/^\d{6}$/.test(code)) throw new Error('Introduza o código de confirmação de 6 dígitos.');
      const result = await client.auth.verifyOtp({ email: normalizedEmail, token: code, type: 'signup' });
      if (result.error) throw result.error;
      if (!result.data || !result.data.user) throw new Error('Não foi possível confirmar o registo. Peça um novo código.');
      return await loadContext(result.data.user);
    },

    normalizePhone(phone) {
      return normalizePhoneE164(phone);
    },

    async requestPhoneChange(phone) {
      if (!client || !this.ready) throw new Error('Inicie sessão por email antes de associar o telemóvel.');
      const normalizedPhone = this.normalizePhone(phone);
      const result = await client.auth.updateUser({ phone: normalizedPhone });
      if (result.error) throw result.error;
      return { phone: normalizedPhone, user: result.data.user };
    },

    async verifyPhoneChange(phone, token) {
      if (!client) throw new Error('Biblioteca de ligação à base de dados não carregou. Atualize a página.');
      const normalizedPhone = this.normalizePhone(phone);
      const code = String(token || '').replace(/\s/g, '');
      if (!/^\d{6}$/.test(code)) throw new Error('Introduza o código SMS de 6 dígitos.');
      const result = await client.auth.verifyOtp({
        phone: normalizedPhone,
        token: code,
        type: 'phone_change'
      });
      if (result.error) throw result.error;
      if (!result.data || !result.data.user) throw new Error('Não foi possível confirmar o telefone. Peça um novo código.');
      const ctx = await loadContext(result.data.user);
      const profileUpdate = await client.from('ks_profiles').upsert({
        user_id: result.data.user.id,
        phone: normalizedPhone,
        updated_at: new Date().toISOString()
      });
      if (profileUpdate.error) throw profileUpdate.error;
      ctx.profile = Object.assign({}, ctx.profile, { phone: normalizedPhone });
      return ctx;
    },

    async signUp(details) {
      if (!client) throw new Error('Biblioteca de ligação à base de dados não carregou. Atualize a página.');
      const result = await client.auth.signUp({
        email: details.email,
        password: details.password,
        options: {
          data: {
            full_name: details.fullName,
            phone: details.phone || '',
            company_legal_name: details.companyName,
            company_trade_name: details.companyName,
            company_tax_id: details.taxId,
            country_code: 'AO',
            currency_code: 'AOA',
            tax_regime: details.taxRegime || 'not_configured',
            selected_plan: details.selectedPlan || localStorage.getItem('kanawa_selected_plan') || 'trial',
            legal_profile: details.legalProfile || {}
          }
        }
      });
      if (result.error) throw result.error;
      if (result.data.session && result.data.user) {
        await loadContext(result.data.user);
      }
      return {
        user: result.data.user,
        session: result.data.session,
        needsEmailConfirmation: !result.data.session
      };
    },

    async signOut() {
      if (!client) return;
      const result = await client.auth.signOut();
      if (result.error) throw result.error;
      context = null;
      try { localStorage.removeItem('kanawa_cloud_context'); } catch (e) { }
    },

    async check() {
      if (!client || !context) return false;
      const result = await client
        .from('ks_company_memberships')
        .select('company_id')
        .eq('company_id', context.company.id)
        .eq('user_id', context.user.id)
        .eq('status', 'active')
        .maybeSingle();
      return !result.error && !!result.data;
    },

    async countRecords() {
      if (!this.ready) return 0;
      const result = await client
        .from('ks_records')
        .select('record_id', { count: 'exact', head: true })
        .eq('company_id', context.company.id);
      if (result.error) throw result.error;
      return result.count || 0;
    },

    async getAllRecords() {
      if (!this.ready) return [];
      const all = [];
      const pageSize = 1000;
      for (let from = 0; ; from += pageSize) {
        const result = await client
          .from('ks_records')
          .select('store_key, record_id, payload, updated_at')
          .eq('company_id', context.company.id)
          .order('store_key', { ascending: true })
          .order('record_id', { ascending: true })
          .range(from, from + pageSize - 1);
        if (result.error) throw result.error;
        const rows = result.data || [];
        all.push.apply(all, rows);
        if (rows.length < pageSize) break;
      }
      return all;
    },

    async getStore(store) {
      if (!this.ready || this.isLocalOnly(store)) return null;
      const result = await client
        .from('ks_records')
        .select('record_id, payload, updated_at')
        .eq('company_id', context.company.id)
        .eq('store_key', store)
        .order('updated_at', { ascending: true });
      if (result.error) throw result.error;
      return (result.data || []).map(function (row) {
        const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
        const id = payload.id !== undefined ? payload.id : (/^\d+$/.test(row.record_id) ? Number(row.record_id) : row.record_id);
        return Object.assign({}, payload, { id: id });
      });
    },

    async upsertRecord(store, item, options) {
      if (!this.ready || this.isLocalOnly(store)) return false;
      const id = String(item.id === undefined || item.id === null ? '' : item.id);
      if (!id || id.length > 120) throw new Error('Identificador de registo inválido para sincronização.');

      // Mirror products into the normalized table so stock and plan quotas are enforced centrally.
      if (store === 'produtos') {
        const stock = Math.max(0, Number(item.estoque) || 0);
        const product = {
          external_id: id,
          sku: item.codigo || item.codigoBarras || null,
          name: item.nome || 'Produto',
          category: item.categoria || null,
          unit: item.unidade || 'UN',
          unit_price: Math.max(0, Number(item.precoVenda !== undefined ? item.precoVenda : item.preco) || 0),
          purchase_cost: item.precoCompra !== undefined ? (item.precoCompra === null ? null : Math.max(0, Number(item.precoCompra) || 0)) : (item.purchase_cost === undefined || item.purchase_cost === null ? null : Math.max(0, Number(item.purchase_cost) || 0)),
          stock_quantity: stock,
          min_stock: Math.max(0, Number(item.estoqueMin !== undefined ? item.estoqueMin : item.estoque_min) || 0),
          description: item.descricao || null,
          image_path: (typeof item.imagem === 'string' && !item.imagem.startsWith('data:')) ? item.imagem : null,
          is_active: item.ativo !== false
        };
        const syncProduct = await client.rpc('ks_sync_product', {
          p_company_id: context.company.id,
          p_product: product
        });
        if (syncProduct.error) throw syncProduct.error;
        if (!(options && options.skipStockSync)) {
          const stockUpdate = await client.from('ks_products')
            .update({ stock_quantity: stock, updated_at: new Date().toISOString() })
            .eq('company_id', context.company.id)
            .eq('external_id', id);
          if (stockUpdate.error) throw stockUpdate.error;
        }
      }

      // Finalized POS sales go through the database transaction which checks licence limits,
      // verifies stock, decrements inventory, and records invoice usage exactly once.
      if (store === 'vendas' && item.status === 'finalizada' && !(options && options.skipSaleFinalize)) {
        const saleItems = (item.itens || item.carrinho || []).map(function (line) {
          const quantity = Number(line.qty !== undefined ? line.qty : line.quantidade) || 0;
          const price = Number(line.preco !== undefined ? line.preco : line.unit_price) || 0;
          const unitCost = line.custoUnitario === null || line.custoUnitario === undefined ? null : Number(line.custoUnitario);
          return {
            product_external_id: String(line.id !== undefined ? line.id : (line.product_external_id || line.product_id || '')),
            product_name: line.nome || line.product_name || 'Artigo',
            quantity: quantity,
            unit_price: price,
            unit_cost: unitCost,
            line_total: Number(line.subtotal !== undefined ? line.subtotal : quantity * price) || 0,
            stock_tracked: true
          };
        });
        if (!saleItems.length || saleItems.some(function (line) { return !line.product_external_id || line.quantity <= 0; })) {
          throw new Error('A venda não pode ser sincronizada: verifique os artigos e quantidades.');
        }
        const invoiceNumber = item.numeroFatura || item.invoice_number || null;
        const documentType = String(item.tipoDocumento || (item.pagamento === 'credito' ? 'FT' : 'FR')).toUpperCase();
        if (!['FT','FR'].includes(documentType)) {
          throw new Error('A venda não pode ser sincronizada: tipo de documento FT/FR inválido.');
        }
        const fiscalDocument = {
          document_type: documentType,
          document_number: invoiceNumber,
          issued_at: item.data || item.sold_at || new Date().toISOString(),
          issuer_snapshot: item.empresa || {
            taxId: context.company.tax_id || context.company.nif || null,
            legalName: context.company.legal_name || context.company.name || null,
            tradeName: context.company.trade_name || null,
            phone: context.company.phone || null,
            email: context.company.email || null
          },
          customer_snapshot: {
            name: item.clienteNome || item.customer_name || 'Consumidor Final',
            taxId: item.clienteNif || item.customer_tax_id || '999999999',
            phone: item.clienteTelefone || item.customer_phone || null,
            address: item.clienteEndereco || item.customer_address || null
          },
          tax_regime: item.regime || item.tax_regime || null,
          currency_code: 'AOA',
          subtotal: Number(item.subtotal) || 0,
          discount_total: Number(item.descontoValor !== undefined ? item.descontoValor : item.discount_value) || 0,
          taxable_base: Number(item.baseIncidencia !== undefined ? item.baseIncidencia : (Number(item.subtotal || 0) - Number(item.descontoValor || 0))) || 0,
          tax_amount: Number(item.iva !== undefined ? item.iva : item.tax_amount) || 0,
          total: Number(item.total) || 0,
          lines: (item.itens || []).map(function(line) {
            return {
              product_id: String(line.id || ''),
              product_code: line.codigo || line.codigoBarras || '',
              description: line.nome || line.product_name || 'Artigo',
              quantity: Number(line.qty || line.quantidade) || 0,
              unit_of_measure: line.unidade || 'UN',
              unit_price: Number(line.preco || line.unit_price) || 0,
              taxable_base: Number(line.taxableBase) || Number(line.subtotal) || 0,
              tax_rate: Number(line.taxRate) || 0,
              tax_amount: Number(line.taxAmount) || 0,
              exemption_reason: line.exemptionReason || line.motivoIsencaoIVA || null
            };
          }),
          metadata: { certification_status: 'not_certified', source: 'Kanawa Soft ERP 1.0' },
          idempotency_key: item.clientEventId || item.client_event_id || null
        };
        const sale = {
          external_id: id,
          invoice_number: invoiceNumber,
          customer_name: item.clienteNome || item.customer_name || null,
          customer_tax_id: item.clienteNif || item.customer_tax_id || null,
          customer_phone: item.clienteTelefone || item.customer_phone || null,
          subtotal: Number(item.subtotal) || 0,
          discount_value: Number(item.descontoValor !== undefined ? item.descontoValor : item.discount_value) || 0,
          tax_amount: Number(item.iva !== undefined ? item.iva : item.tax_amount) || 0,
          total: Number(item.total) || 0,
          amount_received: Number(item.valorRecebido !== undefined ? item.valorRecebido : item.amount_received) || 0,
          change_amount: Number(item.troco !== undefined ? item.troco : item.change_amount) || 0,
          payment_method: item.pagamento || item.payment_method || 'não indicado',
          tax_regime: item.regime || item.tax_regime || null,
          status: 'finalizada',
          notes: item.observacoes || item.notes || null,
          operator_name: item.operador || item.operator_name || null,
          sold_at: item.data || item.sold_at || new Date().toISOString(),
          cashier_user_id: item.cashierUserId || context.user.id,
          cash_session_id: item.cashSessionId || null,
          customer_address: item.clienteEndereco || item.customer_address || null,
          client_event_id: item.clientEventId || item.client_event_id || null,
          client_created_at: item.clientCreatedAt || item.data || item.created_at_client || null
        };
        const finalizeSale = await client.rpc('ks_finalize_fiscal_sale', {
          p_company_id: context.company.id,
          p_sale: sale,
          p_items: saleItems,
          p_fiscal_document: fiscalDocument
        });
        if (finalizeSale.error) throw finalizeSale.error;

        // Read back the authoritative cost snapshot written by PostgreSQL triggers.
        // If read access is temporarily unavailable, keep the sale but mark its profit unknown.
        const finalizedSaleId = finalizeSale.data && (finalizeSale.data.sale_id || finalizeSale.data);
        if (finalizeSale.data && finalizeSale.data.document_number) {
          item.numeroFatura = finalizeSale.data.document_number;
          item.invoice_number = finalizeSale.data.document_number;
          item.tipoDocumento = documentType;
        }
        if (finalizedSaleId) {
          const [saleSnapshot, itemSnapshots] = await Promise.all([
            client.from('ks_sales').select('cost_of_goods,gross_profit')
              .eq('company_id', context.company.id).eq('id', finalizedSaleId).maybeSingle(),
            client.from('ks_sale_items').select('product_external_id,unit_cost,line_profit')
              .eq('company_id', context.company.id).eq('sale_id', finalizedSaleId)
          ]);
          if (!saleSnapshot.error && !itemSnapshots.error && saleSnapshot.data) {
            const byProduct = Object.create(null);
            (itemSnapshots.data || []).forEach(function (row) { byProduct[String(row.product_external_id)] = row; });
            item.custoTotal = saleSnapshot.data.cost_of_goods;
            item.lucroBruto = saleSnapshot.data.gross_profit;
            item.itens = (item.itens || []).map(function (line) {
              const snapshot = byProduct[String(line.id)];
              return Object.assign({}, line, {
                custoUnitario: snapshot ? snapshot.unit_cost : null,
                lucroLinha: snapshot ? snapshot.line_profit : null
              });
            });
          } else {
            item.custoTotal = null;
            item.lucroBruto = null;
            item.itens = (item.itens || []).map(function (line) {
              return Object.assign({}, line, { custoUnitario: null, lucroLinha: null });
            });
            console.warn('Profit snapshot not readable; sale remains finalized with profit unclassified.', saleSnapshot.error || itemSnapshots.error);
          }
        }
      }

      const result = await client
        .from('ks_records')
        .upsert({
          company_id: context.company.id,
          store_key: store,
          record_id: id,
          payload: item
        }, { onConflict: 'company_id,store_key,record_id', ignoreDuplicates: store === 'vendas' });
      if (result.error) throw result.error;
      return true;
    },

    async deleteRecord(store, id) {
      if (store === 'vendas') throw new Error('Vendas finalizadas são imutáveis. Use uma Nota de Crédito (NC) para rectificar ou anular.');
      if (!this.ready || this.isLocalOnly(store)) return false;
      if (store === 'produtos') {
        const deactivate = await client.from('ks_products')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('company_id', context.company.id)
          .eq('external_id', String(id));
        if (deactivate.error) throw deactivate.error;
      }
      const result = await client
        .from('ks_records')
        .delete()
        .eq('company_id', context.company.id)
        .eq('store_key', store)
        .eq('record_id', String(id));
      if (result.error) throw result.error;
      return true;
    },

    async updateCompany(data) {
      if (!this.ready) return;
      const update = {
        legal_name: data.nome || data.firma || context.company.legal_name,
        trade_name: data.firma || data.nome || context.company.trade_name,
        tax_id: data.nif || context.company.tax_id,
        phone: data.telefone || context.company.phone,
        email: data.email || context.company.email,
        updated_at: new Date().toISOString()
      };
      const result = await client.from('ks_companies').update(update).eq('id', context.company.id);
      if (result.error) throw result.error;
      context.company = Object.assign({}, context.company, update);
    },

    async registerInstallation(appVersion) {
      if (!this.ready) return null;
      let key = localStorage.getItem('kanawa_installation_key');
      if (!key) {
        key = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() :
          'ks-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 12);
        localStorage.setItem('kanawa_installation_key', key);
      }
      const existing = failIfError(await client
        .from('ks_installations')
        .select('id')
        .eq('company_id', context.company.id)
        .eq('installation_key', key)
        .maybeSingle());
      const payload = {
        company_id: context.company.id,
        installation_key: key,
        user_id: context.user.id,
        device_name: (navigator.userAgent || 'Dispositivo').slice(0, 180),
        platform: navigator.platform || 'web',
        app_version: appVersion,
        install_status: 'active',
        last_seen_at: new Date().toISOString(),
        metadata: { source: 'kanawasoft.shop', app: 'Kanawa Soft' }
      };
      if (existing) {
        const result = await client.from('ks_installations').update(payload).eq('id', existing.id);
        if (result.error) throw result.error;
      } else {
        const result = await client.from('ks_installations').insert(payload);
        if (result.error) throw result.error;
      }
      return key;
    },

    async issueInvoiceReceipt(input) {
      if (!this.ready || !context.company || !context.company.id) throw new Error('Ligue a empresa para emitir o Recibo (RE).');
      const data=input||{};
      const amount=Number(data.amount);
      if (!data.saleExternalId || !Number.isFinite(amount) || amount<=0 || !data.paymentMethod || !data.idempotencyKey) {
        throw new Error('Indique a fatura, o valor, o meio de pagamento e uma chave de tentativa.');
      }
      const result=await client.rpc('ks_issue_invoice_receipt',{
        p_company_id:context.company.id,
        p_sale_external_id:String(data.saleExternalId),
        p_amount:amount,
        p_payment_method:String(data.paymentMethod),
        p_provider_reference:data.providerReference||null,
        p_idempotency_key:data.idempotencyKey
      });
      return failIfError(result);
    },

    async issueCreditNote(input) {
      if (!this.ready || !context.company || !context.company.id) throw new Error('Ligue a empresa para emitir a Nota de Crédito (NC).');
      const data=input||{};
      const amount=Number(data.amount),base=Number(data.taxableBase),tax=Number(data.taxAmount);
      if (!data.saleExternalId || !data.reason || !Array.isArray(data.lines) || !data.lines.length ||
          !Number.isFinite(amount) || !Number.isFinite(base) || !Number.isFinite(tax) || amount<=0 || !data.idempotencyKey) {
        throw new Error('Preencha a venda original, o motivo, as linhas e os totais fiscais da Nota de Crédito.');
      }
      const result=await client.rpc('ks_issue_credit_note',{
        p_company_id:context.company.id,
        p_sale_external_id:String(data.saleExternalId),
        p_amount:amount,
        p_taxable_base:base,
        p_tax_amount:tax,
        p_reason:String(data.reason),
        p_lines:data.lines,
        p_idempotency_key:data.idempotencyKey
      });
      return failIfError(result);
    },

    async nextInvoiceNumber() {
      throw new Error('A numeração é atribuída atomicamente pelo servidor no momento da emissão. Não reserve números antecipadamente.');
    },

    async getAccountingSnapshot() {
      if (!this.ready || !context.company || !context.company.id) throw new Error('Ligue a empresa para consultar a contabilidade.');
      return failIfError(await client.rpc('ks_accounting_snapshot', { p_company_id: context.company.id }));
    },

    async getAccountingReports(fromDate, toDate) {
      if (!this.ready || !context.company || !context.company.id) throw new Error('Ligue a empresa para consultar os relatórios.');
      return failIfError(await client.rpc('ks_accounting_reports', {
        p_company_id: context.company.id, p_from_date: fromDate, p_to_date: toDate
      }));
    },

    async exportAccountingSaft(fromDate, toDate) {
      if (!this.ready || !context.company || !context.company.id) throw new Error('Ligue a empresa para exportar o SAF-T.');
      const result = await client.functions.invoke('agt-saft-accounting-export', {
        body: { companyId: context.company.id, fromDate, toDate }
      });
      if (result.error) throw result.error;
      if (!result.data || result.data.success !== true || typeof result.data.xml !== 'string') {
        throw new Error(result.data?.error || 'O servidor não devolveu um ficheiro SAF-T válido.');
      }
      return result.data;
    },

    async seedAngolaChartOfAccounts(accounts) {
      if (!this.ready || !context.company || !context.company.id) throw new Error('Ligue a empresa para importar o PGC.');
      return failIfError(await client.rpc('ks_seed_angola_chart_of_accounts', {
        p_company_id: context.company.id, p_accounts: accounts
      }));
    },

    async listCompanyModules() {
      if (!this.ready || !context.company || !context.company.id) throw new Error('Ligue a empresa para consultar os módulos.');
      return failIfError(await client.from('ks_company_module_settings')
        .select('module_id,enabled,updated_at').eq('company_id',context.company.id).order('module_id')) || [];
    },

    async setCompanyModuleEnabled(moduleId, enabled) {
      if (!this.ready || !context.company || !context.company.id) throw new Error('Ligue a empresa para gerir os módulos.');
      const result = failIfError(await client.rpc('ks_set_company_module_enabled', {
        p_company_id: context.company.id, p_module_id: moduleId, p_enabled: !!enabled
      }));
      context.companyModules = context.companyModules || {};
      context.companyModules[moduleId] = !!enabled;
      try { localStorage.setItem('kanawa_cloud_context', JSON.stringify(context)); } catch (e) { }
      return result;
    },

    async getTaxRuleCatalog(taxType, taxGroup) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      let query = client.from('ks_tax_rule_catalog')
        .select('country_code,tax_type,tax_group,regime,lower_bound,upper_bound,fixed_amount,rate,excess_threshold,effective_from,effective_to,legal_reference,source_url')
        .eq('country_code','AO').eq('tax_type',taxType || 'IRT');
      if (taxGroup) query = query.eq('tax_group',taxGroup);
      const rows = failIfError(await query.order('lower_bound')) || [];
      const today = new Date().toISOString().slice(0,10);
      return rows.filter(function (row) { return row.effective_from <= today && (!row.effective_to || row.effective_to >= today); });
    },

    async listTaxReturns() {
      if (!this.ready || !context.company || !context.company.id) throw new Error('Ligue a empresa para consultar as declarações.');
      return failIfError(await client.from('ks_tax_returns').select('*')
        .eq('company_id',context.company.id).order('period_start',{ascending:false}).limit(50)) || [];
    },

    async saveTaxReturn(details) {
      if (!this.ready || !context.company || !context.company.id) throw new Error('Ligue a empresa para guardar a declaração.');
      const row = {
        company_id: context.company.id, tax_type: details.taxType,
        period_start: details.periodStart, period_end: details.periodEnd,
        tax_regime: details.taxRegime || null, taxable_base: Number(details.taxableBase || 0),
        tax_amount: Number(details.taxAmount || 0), tax_credit: Number(details.taxCredit || 0),
        payable_amount: Number(details.payableAmount || 0), status: 'draft',
        payload: details.payload || {}, created_by: context.user.id
      };
      return failIfError(await client.from('ks_tax_returns').insert(row).select('*').single());
    },

    async getAGTStatus() {
      if (!this.ready || !context.company || !context.company.id) throw new Error('Ligue a empresa para consultar a integração AGT.');
      const result = await client.functions.invoke('agt-fiscal-config', {
        body: { action: 'get_status', companyId: context.company.id }
      });
      if (result.error) throw result.error;
      return result.data || {};
    },

    async saveAGTConfig(config) {
      if (!this.ready || !context.company || !context.company.id) throw new Error('Ligue a empresa para configurar a AGT.');
      const result = await client.functions.invoke('agt-fiscal-config', {
        body: Object.assign({ action: 'save_config', companyId: context.company.id }, config || {})
      });
      if (result.error) throw result.error;
      return result.data || {};
    },

    async saveChartAccount(account) {
      if (!this.ready || !context.company || !context.company.id) throw new Error('Ligue a empresa para configurar o plano de contas.');
      return failIfError(await client.rpc('ks_save_chart_account', {
        p_company_id: context.company.id,
        p_account_code: account.code,
        p_name: account.name,
        p_account_type: account.type,
        p_parent_id: account.parentId || null
      }));
    },

    async postJournalEntry(entry) {
      if (!this.ready || !context.company || !context.company.id) throw new Error('Ligue a empresa para lançar movimentos contabilísticos.');
      return failIfError(await client.rpc('ks_post_journal_entry', {
        p_company_id: context.company.id,
        p_entry_date: entry.date,
        p_description: entry.description,
        p_lines: entry.lines
      }));
    },

    async getLicense() {
      if (!this.ready) return null;
      return failIfError(await client
        .from('ks_company_licenses')
        .select('id, plan_code, status, starts_at, expires_at, grace_until, max_users_override, max_installations_override, max_invoices_override, term_months_override, term_code, term_days_override')
        .eq('company_id', context.company.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle());
    },

    async getEntitlements() {
      if (!this.ready) return null;
      return failIfError(await client.rpc('ks_get_company_entitlements', { p_company_id: context.company.id }));
    },


    async logAuditEvent(event) {
      if (!this.ready) return false;
      const result = await client.from('ks_audit_events').insert({
        company_id: context.company.id,
        actor_user_id: context.user.id,
        action: String(event.action || 'activity').slice(0, 100),
        resource_type: String(event.resourceType || 'module').slice(0, 100),
        resource_id: event.resourceId == null ? null : String(event.resourceId).slice(0, 120),
        details: event.details && typeof event.details === 'object' ? event.details : {}
      });
      if (result.error) throw result.error;
      return true;
    },

    async listAuditEvents(limit) {
      if (!this.ready) return [];
      return withFreshAuthRetry(async function () {
        const result = await client.from('ks_audit_events')
          .select('id,actor_user_id,action,resource_type,resource_id,details,created_at')
          .eq('company_id', context.company.id)
          .order('created_at', { ascending: false })
          .limit(Math.min(Math.max(Number(limit) || 150, 1), 500));
        if (result.error) throw result.error;
        const rows = result.data || [];
        const ids = Array.from(new Set(rows.map(row => row.actor_user_id).filter(Boolean)));
        if (!ids.length) return rows;
        const profiles = await client.from('ks_profiles').select('user_id,full_name,email').in('user_id', ids);
        if (profiles.error) throw profiles.error;
        const byId = new Map((profiles.data || []).map(profile => [profile.user_id, profile]));
        return rows.map(row => Object.assign({}, row, { actor: byId.get(row.actor_user_id) || {} }));
      });
    },

    async getActiveCashSession() {
      if (!this.ready) return null;
      const result = await client.from('ks_cash_sessions').select('*')
        .eq('company_id', context.company.id).eq('cashier_user_id', context.user.id).eq('status', 'open')
        .order('opened_at', { ascending: false }).limit(1).maybeSingle();
      if (result.error) throw result.error;
      return result.data || null;
    },

    async listCashSessions(limit) {
      if (!this.ready) return [];
      const result = await client.from('ks_cash_sessions').select('*')
        .eq('company_id', context.company.id).order('opened_at', { ascending: false })
        .limit(Math.min(Math.max(Number(limit) || 100, 1), 300));
      if (result.error) throw result.error;
      return result.data || [];
    },

    async openCashSession(openingFloat, targetAmount, terminalLabel) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const result = await client.rpc('ks_open_cash_session', {
        p_opening_float: Number(openingFloat) || 0,
        p_target_amount: Number(targetAmount) || 0,
        p_terminal_label: terminalLabel || null
      });
      if (result.error) throw result.error;
      return result.data;
    },

    async closeCashSession(sessionId, countedCash) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const result = await client.rpc('ks_close_cash_session', {
        p_session_id: sessionId,
        p_counted_cash: Number(countedCash) || 0
      });
      if (result.error) throw result.error;
      return result.data;
    },

    async getCommercialPolicy() {
      if (!this.ready) return null;
      const result = await client.from('ks_commercial_policies').select('max_discount_percent,max_sale_amount,updated_at')
        .eq('company_id', context.company.id).maybeSingle();
      if (result.error) throw result.error;
      return result.data || null;
    },

    async listCommercialApprovals() {
      if (!this.ready) return [];
      const result = await client.from('ks_commercial_approvals').select('*')
        .eq('company_id', context.company.id).order('created_at', { ascending: false }).limit(200);
      if (result.error) throw result.error;
      return result.data || [];
    },

    async createCommercialApproval(details) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const result = await client.rpc('ks_request_commercial_approval', {
        p_request_type: details.requestType,
        p_reference_id: details.referenceId || null,
        p_description: details.description,
        p_requested_amount: Number(details.requestedAmount) || 0
      });
      if (result.error) throw result.error;
      return result.data;
    },

    async decideCommercialApproval(approvalId, approve, approvedAmount) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const result = await client.rpc('ks_decide_commercial_approval', {
        p_approval_id: approvalId, p_approve: !!approve,
        p_approved_amount: approvedAmount == null ? null : Number(approvedAmount)
      });
      if (result.error) throw result.error;
      return result.data;
    },

    async requestSaleCancellation(saleExternalId, reason) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const result = await client.rpc('ks_request_sale_cancellation', {
        p_sale_external_id: String(saleExternalId),
        p_reason: String(reason || '')
      });
      if (result.error) throw result.error;
      return result.data;
    },

    async listSaleCancellationRequests() {
      if (!this.ready) return [];
      const result = await client.from('ks_sale_cancellation_requests').select('*')
        .eq('company_id', context.company.id).order('created_at', { ascending: false }).limit(200);
      if (result.error) throw result.error;
      return result.data || [];
    },

    async adminCancelSale(saleExternalId, reason) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const result = await client.rpc('ks_admin_cancel_sale', {
        p_sale_external_id: String(saleExternalId), p_reason: String(reason || '')
      });
      if (result.error) throw result.error;
      return result.data;
    },

    async reviewSaleCancellation(requestId, approve, note) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const result = await client.rpc('ks_review_sale_cancellation', {
        p_request_id: requestId, p_approve: !!approve, p_note: note || null
      });
      if (result.error) throw result.error;
      return result.data;
    },

    async attachSaleContext(externalId, cashSessionId, customerAddress) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const result = await client.rpc('ks_attach_sale_context', {
        p_company_id: context.company.id,
        p_external_id: String(externalId),
        p_cash_session_id: cashSessionId || null,
        p_customer_address: customerAddress || null
      });
      if (result.error) throw result.error;
      return result.data;
    },

    async listTeamMembers() {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      return withFreshAuthRetry(async function () {
        const memberships = failIfError(await client.from('ks_company_memberships')
          .select('user_id, role, status, permissions, supervisor_user_id, created_at')
          .eq('company_id', context.company.id)
          .order('created_at', { ascending: true })) || [];
        if (!memberships.length) return [];
        const ids = memberships.map(function (row) { return row.user_id; });
        const profiles = failIfError(await client.from('ks_profiles')
          .select('user_id, full_name, email, phone')
          .in('user_id', ids)) || [];
        const byId = new Map(profiles.map(function (profile) { return [profile.user_id, profile]; }));
        return memberships.map(function (membership) {
          return Object.assign({}, membership, byId.get(membership.user_id) || {});
        });
      });
    },

    async listTeamInvitations() {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      return withFreshAuthRetry(async function () {
        return failIfError(await client.from('ks_team_invitations')
          .select('id, email, full_name, role, supervisor_user_id, expires_at, accepted_at, created_at')
          .eq('company_id', context.company.id)
          .order('created_at', { ascending: false })) || [];
      });
    },

    async createTeamInvitation(details) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const result = await client.rpc('ks_create_team_invitation', {
        p_email: String(details.email || '').trim().toLowerCase(),
        p_full_name: String(details.fullName || '').trim(),
        p_role: details.role,
        p_permissions: details.permissions || {},
        p_expires_hours: 72
      });
      if (result.error) throw result.error;
      return result.data;
    },

    async updateTeamMemberAccess(details) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const result = await client.rpc('ks_update_team_member_access', {
        p_user_id: details.userId,
        p_role: details.role,
        p_permissions: details.permissions || {},
        p_status: details.status || 'active'
      });
      if (result.error) throw result.error;
      return result.data;
    },

    async acceptInvitation(details) {
      if (!client) throw new Error('Biblioteca de ligação à base de dados não carregou. Atualize a página.');
      const email = String(details.email || '').trim().toLowerCase();
      const password = String(details.password || '');
      const code = String(details.invitationCode || '').trim();
      const fullName = String(details.fullName || '').trim();
      if (!email || !fullName || password.length < 8 || !code) {
        throw new Error('Nome, email, senha com pelo menos 8 caracteres e código de convite são obrigatórios.');
      }
      const result = await client.auth.signUp({
        email: email,
        password: password,
        options: { data: { full_name: fullName, invitation_code: code } }
      });
      if (result.error) throw result.error;
      if (result.data.session && result.data.user) await loadContext(result.data.user);
      return {
        user: result.data.user,
        session: result.data.session,
        needsEmailConfirmation: !result.data.session
      };
    },

    async getPlans() {
      if (!client) throw new Error('Ligação cloud indisponível.');
      const result = await client.from('ks_saas_plans')
        .select('plan_code,name,price,currency_code,max_users,max_installations,max_invoices_period,billing_period,duration_months,features')
        .eq('is_active', true).eq('is_public', true).order('display_order');
      if (result.error) throw result.error;
      return result.data || [];
    },

    async getLicenseTerms() {
      if (!client) throw new Error('Ligação cloud indisponível.');
      const result = await client.from('ks_license_terms')
        .select('term_code,name,duration_days,duration_months,is_lifetime,internal_only,display_order')
        .eq('is_active', true).eq('internal_only', false).order('display_order');
      if (result.error) throw result.error;
      return result.data || [];
    },

    async redeemLicenseKey(key) {
      if (!this.ready) throw new Error('Entre na empresa antes de activar a chave.');
      const result = await client.rpc('ks_redeem_license_key', { p_license_key: String(key || '').trim(), p_company_id: context.company.id });
      if (result.error) throw result.error;
      return result.data;
    },

    async requestPaymentActivation(details) {
      if (!this.ready) throw new Error('Entre na sua conta para solicitar activação.');
      const result = await client.from('ks_payment_requests').insert({
        company_id: context.company.id,
        plan_code: details.planCode,
        term_code: details.termCode,
        duration_months: Number(details.durationMonths || 0),
        duration_days: Number(details.durationDays || 0),
        amount: Number(details.amount),
        currency_code: 'AOA',
        payment_method: details.paymentMethod,
        transaction_reference: details.transactionReference || null,
        proof_path: details.proofPath,
        requested_by: context.user.id
      }).select('id,status').single();
      if (result.error) throw result.error;
      return result.data;
    },

    async uploadPrivateFile(bucket, file, category) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      if (!file || file.size > 15 * 1024 * 1024) throw new Error('Seleccione um ficheiro até 15 MB.');
      const allowed = ['application/pdf','image/jpeg','image/png','image/webp'];
      if (!allowed.includes(file.type)) throw new Error('Formato não permitido. Utilize PDF, JPG, PNG ou WEBP.');
      const safeName = String(file.name || 'documento').normalize('NFKD').replace(/[^a-zA-Z0-9._-]/g,'_').slice(-90);
      const path = context.company.id + '/' + context.user.id + '/' + Date.now() + '-' + safeName;
      const result = await client.storage.from(bucket).upload(path, file, { upsert: false, contentType: file.type });
      if (result.error) throw result.error;
      return result.data.path;
    },

    async getCompanyLegalProfile() {
      if (!this.ready) return null;
      const result = await client.from('ks_company_legal_profiles').select('*').eq('company_id', context.company.id).maybeSingle();
      if (result.error) throw result.error;
      return result.data;
    },

    async saveCompanyLegalProfile(data) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const result = await client.from('ks_company_legal_profiles').upsert(
        Object.assign({}, data, { company_id: context.company.id, updated_at: new Date().toISOString() }),
        { onConflict: 'company_id' }
      );
      if (result.error) throw result.error;
      return true;
    },

    async getExpiringDocuments(daysAhead) {
      if (!this.ready) return [];
      const end = new Date(Date.now() + Number(daysAhead || 90) * 86400000).toISOString().slice(0,10);
      const today = new Date().toISOString().slice(0,10);
      const [companyDocs,employeeDocs] = await Promise.all([
        client.from('ks_company_documents').select('id,title,document_type,expires_at,status').eq('company_id',context.company.id).not('expires_at','is',null).lte('expires_at',end),
        client.from('ks_employee_documents').select('id,title,document_type,expires_at,status,employee_id').eq('company_id',context.company.id).not('expires_at','is',null).lte('expires_at',end)
      ]);
      if(companyDocs.error) throw companyDocs.error;
      if(employeeDocs.error) throw employeeDocs.error;
      return [
        ...(companyDocs.data||[]).map(x=>Object.assign({scope:'Empresa'},x)),
        ...(employeeDocs.data||[]).map(x=>Object.assign({scope:'Funcionário'},x))
      ].map(x=>Object.assign(x,{days_remaining:Math.ceil((new Date(x.expires_at+'T23:59:59').getTime()-Date.now())/86400000)}))
       .sort((a,b)=>a.days_remaining-b.days_remaining);
    },

    async getCompanyDocuments() {
      if (!this.ready) return [];
      const result = await client.from('ks_company_documents').select('*').eq('company_id', context.company.id).order('expires_at', { ascending: true });
      if (result.error) throw result.error;
      return result.data || [];
    },

    async saveCompanyDocument(data) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const result = await client.from('ks_company_documents').insert(Object.assign({}, data, { company_id: context.company.id }));
      if (result.error) throw result.error;
      return result.data;
    },

    async upsertEmployee(details) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const employeeNumber = String(details.employeeNumber || ('EMP-' + Date.now()));
      const payload = {
        company_id: context.company.id, employee_number: employeeNumber,
        full_name: details.fullName, email: details.email || null, phone: details.phone || null,
        tax_id: details.taxId || null, department: details.department || null,
        job_title: details.jobTitle || null, hire_date: details.hireDate || null,
        employment_status: details.status || 'active', salary_amount: Number(details.salary || 0)
      };
      const result = await client.from('ks_employees').upsert(payload,{onConflict:'company_id,employee_number'}).select('id,employee_number').single();
      if (result.error) throw result.error;
      return result.data;
    },

    async saveEmployeeCompensation(details) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const result = await client.from('ks_employee_compensation_history').insert({
        company_id: context.company.id, employee_id: details.employeeId,
        effective_from: details.effectiveFrom || new Date().toISOString().slice(0,10),
        base_salary: Number(details.baseSalary || 0), transport_allowance: Number(details.transportAllowance || 0),
        meal_allowance: Number(details.mealAllowance || 0), recurring_bonus: Number(details.bonus || 0),
        reason: details.reason || 'Registo inicial'
      });
      if (result.error) throw result.error;
      return result.data;
    },

    async getEmployeeDocuments() {
      if (!this.ready) return [];
      const result = await client.from('ks_employee_documents').select('*').eq('company_id',context.company.id).order('expires_at',{ascending:true});
      if (result.error) throw result.error;
      return result.data || [];
    },

    async saveEmployeeDocument(details) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const result = await client.from('ks_employee_documents').insert({
        company_id:context.company.id, employee_id:details.employeeId,
        document_type:details.documentType, title:details.title, document_number:details.documentNumber||null,
        issued_at:details.issuedAt||null, expires_at:details.expiresAt||null,
        file_path:details.filePath, status:'valid', reminder_days:[60,30,15,7]
      }).select('*').single();
      if (result.error) throw result.error;
      return result.data;
    },

    async issueLicenseKey(planCode, durationMonths, paymentRequestId) {
      if (!this.ready || !context.isPlatformAdmin) throw new Error('Apenas o proprietário registado da plataforma pode emitir chaves.');
      const result = await client.rpc('ks_issue_license_key', { p_plan_code: planCode, p_duration_months: Number(durationMonths), p_payment_request_id: paymentRequestId || null });
      if (result.error) throw result.error;
      return result.data;
    },

    async issueLicenseKeyByTerm(planCode, termCode, paymentRequestId) {
      if (!this.ready || !context.isPlatformAdmin) throw new Error('Apenas o proprietário registado da plataforma pode emitir chaves.');
      const result = await client.rpc('ks_issue_license_key_by_term', {
        p_plan_code: planCode, p_term_code: termCode, p_payment_request_id: paymentRequestId || null
      });
      if (result.error) throw result.error;
      return result.data;
    },

    async listAllPaymentRequests() {
      if (!this.ready || !context.isPlatformAdmin) throw new Error('Acesso reservado ao proprietário da plataforma.');
      const result = await client.from('ks_payment_requests')
        .select('id,company_id,plan_code,term_code,duration_months,duration_days,amount,payment_method,transaction_reference,proof_path,status,created_at,company:ks_companies(legal_name,trade_name,email,phone)')
        .eq('status','pending').order('created_at',{ascending:true});
      if (result.error) throw result.error;
      return result.data || [];
    },

    async getPrivateFileUrl(bucket, path) {
      if (!this.ready) throw new Error('Inicie sessão para consultar o ficheiro.');
      const result = await client.storage.from(bucket).createSignedUrl(path, 300);
      if (result.error) throw result.error;
      return result.data.signedUrl;
    },

    async createGeneralExpense(details) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const result=await client.from('ks_general_expenses').insert({
        company_id:context.company.id,category:details.category,description:details.description,
        supplier_name:details.supplierName||null,amount:Number(details.amount||0),
        incurred_on:details.incurredOn||new Date().toISOString().slice(0,10),
        due_on:details.dueOn||null,status:'pending',submitted_by:context.user.id
      }).select('id').single();
      if(result.error)throw result.error;
      return result.data;
    },

    async listGeneralExpenses() {
      if(!this.ready)return [];
      const result=await client.from('ks_general_expenses').select('*').eq('company_id',context.company.id).order('incurred_on',{ascending:false});
      if(result.error)throw result.error;
      return result.data||[];
    },

    async updateGeneralExpenseStatus(id,status) {
      if(!this.ready)throw new Error('Sessão cloud não disponível.');
      const result=await client.from('ks_general_expenses').update({status,paid_at:status==='paid'?new Date().toISOString():null,approved_by:context.user.id}).eq('id',id).eq('company_id',context.company.id).select('id').single();
      if(result.error)throw result.error;
      return result.data;
    },

    async createLeaveRequest(details) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const result=await client.from('ks_leave_requests').insert({
        company_id:context.company.id,employee_id:details.employeeId,leave_type_id:details.leaveTypeId||null,
        starts_on:details.startsOn,ends_on:details.endsOn,requested_days:Number(details.days||0),
        reason:details.reason||null,requested_by:context.user.id,status:'pending'
      }).select('id').single();
      if(result.error)throw result.error;
      return result.data;
    },

    async listLeaveRequests() {
      if(!this.ready)return [];
      const result=await client.from('ks_leave_requests').select('*').eq('company_id',context.company.id).order('created_at',{ascending:false});
      if(result.error)throw result.error;
      return result.data||[];
    },

    async decideLeaveRequest(id,status,note) {
      if(!this.ready)throw new Error('Sessão cloud não disponível.');
      const result=await client.from('ks_leave_requests').update({
        status,decided_by:context.user.id,decided_at:new Date().toISOString(),decision_note:note||null
      }).eq('id',id).eq('company_id',context.company.id).select('id').single();
      if(result.error)throw result.error;
      return result.data;
    },

    async listDepartments() {
      if(!this.ready)return [];
      const result=await client.from('ks_departments').select('*').eq('company_id',context.company.id).order('name');
      if(result.error)throw result.error;
      return result.data||[];
    },

    async listBudgets() {
      if(!this.ready)return [];
      const result=await client.from('ks_budgets').select('*').eq('company_id',context.company.id).order('fiscal_year',{ascending:false});
      if(result.error)throw result.error;
      return result.data||[];
    },

    async createCalendarEvent(details) {
      if(!this.ready)throw new Error('Sessão cloud não disponível.');
      const result=await client.from('ks_calendar_events').insert({
        company_id:context.company.id,title:details.title,description:details.description||null,
        event_type:details.eventType||'event',starts_at:details.startsAt,ends_at:details.endsAt||null,
        location:details.location||null,organizer_user_id:context.user.id,status:'scheduled'
      }).select('*').single();
      if(result.error)throw result.error;
      return result.data;
    },

    async listCalendarEvents() {
      if(!this.ready)return [];
      const result=await client.from('ks_calendar_events').select('*').eq('company_id',context.company.id).order('starts_at',{ascending:true});
      if(result.error)throw result.error;
      return result.data||[];
    },

    async createDepartment(details) {
      if(!this.ready)throw new Error('Sessão cloud não disponível.');
      const result=await client.from('ks_departments').insert({
        company_id:context.company.id,name:details.name,code:details.code||null,
        manager_user_id:details.managerUserId||null,status:'active'
      }).select('id').single();
      if(result.error)throw result.error;
      return result.data;
    },

    async createBudget(details) {
      if(!this.ready)throw new Error('Sessão cloud não disponível.');
      const result=await client.from('ks_budgets').insert({
        company_id:context.company.id,name:details.name,fiscal_year:Number(details.fiscalYear),
        period_type:'annual',approved_amount:Number(details.amount||0),status:'draft'
      }).select('id').single();
      if(result.error)throw result.error;
      return result.data;
    },

    async savePayrollRun(details) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const runResult = await client.from('ks_payroll_runs').insert({
        company_id:context.company.id, period_start:details.periodStart, period_end:details.periodEnd,
        status:'processed', gross_total:details.grossTotal, deductions_total:details.deductionsTotal,
        net_total:details.netTotal
      }).select('id').single();
      if (runResult.error) throw runResult.error;
      const items = (details.items || []).filter(x=>x.employeeId).map(x=>({
        company_id:context.company.id, payroll_run_id:runResult.data.id, employee_id:x.employeeId,
        gross_pay:x.gross, irt:x.irt, social_security:x.employeeInss, employer_social_security:x.employerInss,
        bonus:x.bonus, allowances:x.allowances, net_pay:x.net
      }));
      if(items.length){
        const itemResult=await client.from('ks_payroll_items').insert(items);
        if(itemResult.error) throw itemResult.error;
      }
      return runResult.data.id;
    },

    async listMeetings() {
      if (!this.ready) return [];
      const result=await client.from('ks_meetings').select('*').eq('company_id',context.company.id).order('starts_at',{ascending:true});
      if(result.error) throw result.error;
      return result.data||[];
    },

    async createMeeting(details) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const result=await client.from('ks_meetings').insert({
        company_id:context.company.id,title:details.title,agenda:details.agenda||null,
        meeting_type:details.meetingType||'internal',starts_at:details.startsAt,ends_at:details.endsAt||null,
        location:details.location||null,meeting_url:details.meetingUrl||null,
        organizer_user_id:context.user.id,status:'scheduled'
      }).select('*').single();
      if(result.error) throw result.error;
      const attendees=(details.attendees||[]).filter(Boolean).map(email=>({
        company_id:context.company.id,meeting_id:result.data.id,email,external_name:email,attendance_status:'invited'
      }));
      if(attendees.length){const a=await client.from('ks_meeting_attendees').insert(attendees);if(a.error)throw a.error;}
      return result.data;
    },

    async listInternalMessages() {
      if (!this.ready) return [];
      const result=await client.from('ks_internal_messages').select('*').eq('company_id',context.company.id).is('deleted_at',null).order('created_at',{ascending:false}).limit(100);
      if(result.error) throw result.error;
      return result.data||[];
    },

    async sendInternalMessage(body, channel) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const result=await client.from('ks_internal_messages').insert({
        company_id:context.company.id,sender_user_id:context.user.id,body:String(body||'').slice(0,10000),
        channel_id:channel||null
      }).select('*').single();
      if(result.error) throw result.error;
      return result.data;
    },

    async listSharedFiles() {
      if (!this.ready) return [];
      const result=await client.from('ks_shared_files').select('*').eq('company_id',context.company.id).order('created_at',{ascending:false});
      if(result.error) throw result.error;
      return result.data||[];
    },

    async createSharedFile(details) {
      if (!this.ready) throw new Error('Sessão cloud não disponível.');
      const result=await client.from('ks_shared_files').insert({
        company_id:context.company.id,title:details.title,description:details.description||null,
        file_path:details.filePath,category:details.category||'Geral',
        shared_by:context.user.id,visibility:details.visibility||'company'
      }).select('*').single();
      if(result.error) throw result.error;
      return result.data;
    },

    async getPaymentRequests() {
      if (!this.ready) return [];
      const result = await client.from('ks_payment_requests').select('id,plan_code,duration_months,amount,payment_method,status,created_at,review_note').eq('company_id', context.company.id).order('created_at', { ascending: false });
      if (result.error) throw result.error;
      return result.data || [];
    },

    async submitDemoRequest(details) {
      if (!client) throw new Error('Serviço de demonstração indisponível.');
      const result = await client.from('ks_demo_requests').insert({
        company_name: details.companyName,
        contact_name: details.contactName,
        email: details.email,
        phone: details.phone || null,
        country_code: 'AO',
        preferred_plan: details.preferredPlan || null,
        requested_modules: details.modules || [],
        source: 'kanawa_site'
      });
      if (result.error) throw result.error;
      return true;
    }
  };

  window.KanawaCloud = Cloud;
})();