import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { MockStore } from './mock-store';
import { ProductsService } from './products.service';
import { PartnersService } from './partners.service';
import { DocumentsService } from './documents.service';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mockStore: MockStore,
    private readonly productsService: ProductsService,
    private readonly partnersService: PartnersService,
    private readonly documentsService: DocumentsService,
  ) {}

  private useSupabase(): boolean {
    return this.supabaseService.isInitialized();
  }

  // ==========================================
  // DELEGATE 1. PRODOTTI
  // ==========================================
  getProducts() {
    return this.productsService.getProducts();
  }

  getProductById(id: string) {
    return this.productsService.getProductById(id);
  }

  saveProduct(productData: any) {
    return this.productsService.saveProduct(productData);
  }

  deleteProduct(id: string) {
    return this.productsService.deleteProduct(id);
  }

  mergeProducts(targetProductId: string, sourceProductId: string) {
    return this.productsService.mergeProducts(targetProductId, sourceProductId);
  }

  getProductBySkuOrAlias(sku: string) {
    return this.productsService.getProductBySkuOrAlias(sku);
  }

  // ==========================================
  // DELEGATE 2. PARTNER
  // ==========================================
  getPartners() {
    return this.partnersService.getPartners();
  }

  savePartner(partnerData: any) {
    return this.partnersService.savePartner(partnerData);
  }

  deletePartner(id: string) {
    return this.partnersService.deletePartner(id);
  }

  // ==========================================
  // DELEGATE 3. LISTINI & CALCOLI
  // ==========================================
  getPriceLists() {
    return this.partnersService.getPriceLists();
  }

  calculatePartnerProductPrice(partnerId: string, productId: string) {
    return this.partnersService.calculatePartnerProductPrice(partnerId, productId);
  }

  // ==========================================
  // DELEGATE 4. DOCUMENTI
  // ==========================================
  getDocuments() {
    return this.documentsService.getDocuments();
  }

  getDocumentById(id: string) {
    return this.documentsService.getDocumentById(id);
  }

  saveDocument(docData: any) {
    return this.documentsService.saveDocument(docData);
  }

  updateDocumentStatus(id: string, status: 'draft' | 'completed' | 'cancelled') {
    return this.documentsService.updateDocumentStatus(id, status);
  }

  approveAllDrafts() {
    return this.documentsService.approveAllDrafts();
  }

  deleteDocument(id: string) {
    return this.documentsService.deleteDocument(id);
  }

  importXmlInvoice(xmlContent: string) {
    return this.documentsService.importXmlInvoice(xmlContent);
  }

  // ==========================================
  // DELEGATE 5. DEPOSITI (WAREHOUSES)
  // ==========================================
  async getWarehouses(): Promise<any[]> {
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { data, error } = await client.from('warehouses').select('*').order('name', { ascending: true });
      if (error) {
        this.logger.error(`Errore nel recupero dei depositi da Supabase: ${error.message}`);
        throw new BadRequestException(error.message);
      }
      return data;
    }
    return this.mockStore.warehouses;
  }

  // ==========================================
  // DELEGATE 6. AGENTI
  // ==========================================
  async getAgents(): Promise<any[]> {
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { data, error } = await client.from('agents').select('*').order('name', { ascending: true });
      if (error) {
        this.logger.error(`Errore nel recupero degli agenti da Supabase: ${error.message}`);
        throw new BadRequestException(error.message);
      }
      return data;
    }
    return this.mockStore.agents;
  }

  async saveAgent(agentData: any): Promise<any> {
    const isEdit = !!agentData.id;
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const payload: any = {
        name: agentData.name,
        email: agentData.email,
        phone: agentData.phone,
        vat_number: agentData.vat_number,
        default_commission_percent: Number(agentData.default_commission_percent) || 10.00,
      };

      if (agentData.password) {
        payload.password = agentData.password;
      }

      let result;
      if (isEdit) {
        result = await client.from('agents').update(payload).eq('id', agentData.id).select().single();
      } else {
        result = await client.from('agents').insert([payload]).select().single();
      }
      if (result.error) {
        this.logger.error(`Errore nel salvataggio dell'agente in Supabase: ${result.error.message}`);
        if (result.error.code === '42703') {
          throw new BadRequestException(
            "La colonna 'password' non esiste nella tabella 'agents'. Assicurati di aver eseguito la migrazione SQL (20260526010000_agent_roles_and_suggestions.sql) su Supabase."
          );
        }
        throw new BadRequestException(result.error.message);
      }
      return result.data;
    }

    if (isEdit) {
      const idx = this.mockStore.agents.findIndex(a => a.id === agentData.id);
      if (idx === -1) throw new Error('Agente non trovato');
      const updatedAgent = {
        ...this.mockStore.agents[idx],
        ...agentData,
        default_commission_percent: Number(agentData.default_commission_percent) || 10.00
      };
      if (!agentData.password) {
        // preserve existing password
        updatedAgent.password = this.mockStore.agents[idx].password;
      }
      this.mockStore.agents[idx] = updatedAgent;
      return this.mockStore.agents[idx];
    } else {
      const newAgent = {
        id: crypto.randomUUID(),
        name: agentData.name,
        email: agentData.email,
        phone: agentData.phone,
        vat_number: agentData.vat_number,
        default_commission_percent: Number(agentData.default_commission_percent) || 10.00,
        password: agentData.password || '',
        created_at: new Date().toISOString()
      };
      this.mockStore.agents.push(newAgent);
      return newAgent;
    }
  }

  async getCommissions(): Promise<any[]> {
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { data, error } = await client.from('agent_commissions').select('*, agent:agents(name)');
      if (error) {
        this.logger.error(`Errore nel recupero delle provvigioni da Supabase: ${error.message}`);
        throw new BadRequestException(error.message);
      }
      return data;
    }
    return this.mockStore.agentCommissions.map(c => {
      const agent = this.mockStore.agents.find(a => a.id === c.agent_id);
      return {
        ...c,
        agent: agent ? { name: agent.name } : null
      };
    });
  }

  // ==========================================
  // DELEGATE 7. SIAN & ACCISE EXPORTS
  // ==========================================
  exportSianXml(documentId: string) {
    return this.documentsService.exportSianXml(documentId);
  }

  exportAcciseXml(documentId: string) {
    return this.documentsService.exportAcciseXml(documentId);
  }

  // ==========================================
  // DELEGATE 8. RICONCILIAZIONE
  // ==========================================
  reconcileBankFile(fileContent: string) {
    return this.documentsService.reconcileBankFile(fileContent);
  }

  // ==========================================
  // 9. AUTENTICAZIONE E SEGNALAZIONE PRODOTTI
  // ==========================================
  async login(username: string, password: string): Promise<any> {
    const trimmedUser = username.trim().toLowerCase();
    const trimmedPass = password.trim();

    if (trimmedUser === 'master' && trimmedPass === 'master') {
      return { success: true, role: 'master', name: 'Master' };
    }

    if (trimmedUser === 'autorizzato' && trimmedPass === 'autorizzato') {
      return { success: true, role: 'viewer', name: 'Visualizzatore' };
    }

    if (trimmedUser === 'ristoratore' && trimmedPass === 'ristoratore') {
      return { success: true, role: 'ristoratore', name: 'Ristoratore' };
    }

    // Cerca tra gli agenti
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { data, error } = await client
        .from('agents')
        .select('*')
        .or(`email.ilike.${trimmedUser},name.ilike.${trimmedUser}`);

      if (error) {
        this.logger.error(`Errore nel login agente da Supabase: ${error.message}`);
        throw new BadRequestException(error.message);
      }

      const agent = data?.find(a => a.password === trimmedPass);
      if (agent) {
        return { success: true, role: 'agent', agentId: agent.id, name: agent.name };
      }
    } else {
      const agent = this.mockStore.agents.find(
        a =>
          (a.email.toLowerCase() === trimmedUser || a.name.toLowerCase() === trimmedUser) &&
          a.password === trimmedPass
      );
      if (agent) {
        return { success: true, role: 'agent', agentId: agent.id, name: agent.name };
      }
    }

    // Cerca tra i partner (ristoratori)
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { data, error } = await client
        .from('partners')
        .select('*')
        .or(`email.ilike.${trimmedUser},name.ilike.${trimmedUser}`);

      if (error) {
        this.logger.error(`Errore nel login partner da Supabase: ${error.message}`);
        throw new BadRequestException(error.message);
      }

      const partner = data?.find(
        p =>
          (p.type === 'client' || p.type === 'both') &&
          p.password === trimmedPass
      );
      if (partner) {
        return { success: true, role: 'ristoratore', name: partner.name };
      }
    } else {
      const partner = this.mockStore.partners.find(
        p =>
          (p.type === 'client' || p.type === 'both') &&
          p.email &&
          (p.email.toLowerCase() === trimmedUser || p.name.toLowerCase() === trimmedUser) &&
          p.password === trimmedPass
      );
      if (partner) {
        return { success: true, role: 'ristoratore', name: partner.name };
      }
    }

    throw new BadRequestException('Credenziali non valide. Riprova.');
  }

  async getProductSuggestions(agentId?: string): Promise<any[]> {
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      let query = client.from('product_suggestions').select('*, agent:agents(name)');
      if (agentId) {
        query = query.eq('agent_id', agentId);
      }
      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) {
        this.logger.error(`Errore nel recupero delle segnalazioni da Supabase: ${error.message}`);
        if (error.code === '42P01') {
          throw new BadRequestException(
            "La tabella 'product_suggestions' non esiste a database. Assicurati di aver eseguito la migrazione SQL (20260526010000_agent_roles_and_suggestions.sql) nel pannello SQL Editor su Supabase."
          );
        }
        throw new BadRequestException(error.message);
      }
      return data;
    }

    let suggestions = this.mockStore.productSuggestions;
    if (agentId) {
      suggestions = suggestions.filter(s => s.agent_id === agentId);
    }
    return suggestions.map(s => {
      const agent = this.mockStore.agents.find(a => a.id === s.agent_id);
      return {
        ...s,
        agent: agent ? { name: agent.name } : null
      };
    });
  }

  async createProductSuggestion(suggestionData: any): Promise<any> {
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const payload = {
        agent_id: suggestionData.agent_id || null,
        product_name: suggestionData.product_name,
        winery: suggestionData.winery,
        price_list: suggestionData.price_list,
        recommended_price: Number(suggestionData.recommended_price),
        notes: suggestionData.notes || '',
        status: 'pending'
      };
      const { data, error } = await client.from('product_suggestions').insert([payload]).select().single();
      if (error) {
        this.logger.error(`Errore nella creazione della segnalazione in Supabase: ${error.message}`);
        if (error.code === '42P01') {
          throw new BadRequestException(
            "La tabella 'product_suggestions' non esiste a database. Esegui la migrazione SQL su Supabase."
          );
        }
        throw new BadRequestException(error.message);
      }
      return data;
    }

    const newSuggestion = {
      id: crypto.randomUUID(),
      agent_id: suggestionData.agent_id || null,
      product_name: suggestionData.product_name,
      winery: suggestionData.winery,
      price_list: suggestionData.price_list,
      recommended_price: Number(suggestionData.recommended_price),
      notes: suggestionData.notes || '',
      status: 'pending' as const,
      created_at: new Date().toISOString()
    };
    this.mockStore.productSuggestions.push(newSuggestion);
    return newSuggestion;
  }

  async updateProductSuggestionStatus(id: string, status: 'accepted' | 'refused'): Promise<any> {
    let suggestion: any = null;

    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { data, error } = await client
        .from('product_suggestions')
        .update({ status })
        .eq('id', id)
        .select()
        .single();
      if (error) {
        this.logger.error(`Errore nell'aggiornamento dello stato della segnalazione in Supabase: ${error.message}`);
        if (error.code === '42P01') {
          throw new BadRequestException(
            "La tabella 'product_suggestions' non esiste a database. Esegui la migrazione SQL su Supabase."
          );
        }
        throw new BadRequestException(error.message);
      }
      suggestion = data;
    } else {
      const idx = this.mockStore.productSuggestions.findIndex(s => s.id === id);
      if (idx === -1) throw new BadRequestException('Segnalazione non trovata');
      this.mockStore.productSuggestions[idx].status = status;
      suggestion = this.mockStore.productSuggestions[idx];
    }

    // Se accettata, creiamo il prodotto in bozza nel catalogo
    if (status === 'accepted' && suggestion) {
      const productPayload = {
        sku: `SEG-${Date.now().toString().slice(-6)}`,
        name: suggestion.product_name.toUpperCase(),
        vintage: 'NV',
        format: '0.75L',
        base_cost: Number((suggestion.recommended_price * 0.7).toFixed(2)),
        discounted_cost: null,
        markup_percent: 43.0,
        vat_percent: 22.0,
        is_manual_price: true,
        manual_price: Number(suggestion.recommended_price),
        stock_quantity: 0,
        notes: `Inserito da segnalazione agente. Cantina: ${suggestion.winery}. Note: ${suggestion.notes || ''}`
      };
      
      await this.productsService.saveProduct(productPayload);
    }

    return suggestion;
  }

  async getSettings(): Promise<Record<string, string>> {
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { data, error } = await client.from('system_settings').select('*');
      if (error) {
        this.logger.error(`Errore nel recupero delle impostazioni da Supabase: ${error.message}`);
        return { hide_prices_globally: 'false' };
      }
      const settingsObj: Record<string, string> = {};
      data?.forEach(row => {
        settingsObj[row.key] = row.value;
      });
      if (!settingsObj.hasOwnProperty('hide_prices_globally')) {
        settingsObj.hide_prices_globally = 'false';
      }
      return settingsObj;
    }
    return this.mockStore.settings;
  }

  async saveSetting(key: string, value: string): Promise<any> {
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { error } = await client
        .from('system_settings')
        .upsert({ key, value, updated_at: new Date().toISOString() });
      if (error) {
        this.logger.error(`Errore nel salvataggio dell'impostazione ${key} in Supabase: ${error.message}`);
        throw new BadRequestException(error.message);
      }
      return { key, value };
    }
    this.mockStore.settings[key] = value;
    return { key, value };
  }
}
