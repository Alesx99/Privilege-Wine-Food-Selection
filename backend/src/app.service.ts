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
      if (error) throw new BadRequestException(error.message);
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
      if (error) throw new BadRequestException(error.message);
      return data;
    }
    return this.mockStore.agents;
  }

  async saveAgent(agentData: any): Promise<any> {
    const isEdit = !!agentData.id;
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const payload = {
        name: agentData.name,
        email: agentData.email,
        phone: agentData.phone,
        vat_number: agentData.vat_number,
        default_commission_percent: Number(agentData.default_commission_percent) || 10.00,
      };

      let result;
      if (isEdit) {
        result = await client.from('agents').update(payload).eq('id', agentData.id).select().single();
      } else {
        result = await client.from('agents').insert([payload]).select().single();
      }
      if (result.error) throw new BadRequestException(result.error.message);
      return result.data;
    }

    if (isEdit) {
      const idx = this.mockStore.agents.findIndex(a => a.id === agentData.id);
      if (idx === -1) throw new Error('Agente non trovato');
      this.mockStore.agents[idx] = {
        ...this.mockStore.agents[idx],
        ...agentData,
        default_commission_percent: Number(agentData.default_commission_percent) || 10.00
      };
      return this.mockStore.agents[idx];
    } else {
      const newAgent = {
        id: crypto.randomUUID(),
        name: agentData.name,
        email: agentData.email,
        phone: agentData.phone,
        vat_number: agentData.vat_number,
        default_commission_percent: Number(agentData.default_commission_percent) || 10.00,
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
      if (error) throw new BadRequestException(error.message);
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
}
