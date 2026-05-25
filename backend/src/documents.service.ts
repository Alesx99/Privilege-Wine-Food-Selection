import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { MockStore, Document, DocumentItem } from './mock-store';
import { PartnersService } from './partners.service';
import { ProductsService } from './products.service';
import { SianService } from './sian.service';
import { AcciseService } from './accise.service';
import { ReconciliationService } from './reconciliation.service';
import { parseXmlInvoice, getBaseSku } from './xml-utils';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mockStore: MockStore,
    private readonly partnersService: PartnersService,
    private readonly productsService: ProductsService,
    private readonly sianService: SianService,
    private readonly acciseService: AcciseService,
    private readonly reconciliationService: ReconciliationService,
  ) {}

  private useSupabase(): boolean {
    return this.supabaseService.isInitialized();
  }

  async getDocuments(): Promise<any[]> {
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { data, error } = await client
        .from('documents')
        .select(`
          *,
          partner:partners(name, vat_number)
        `)
        .order('date', { ascending: false });
      if (error) throw new BadRequestException(error.message);
      return data;
    }
    
    return this.mockStore.documents.map(doc => {
      const partner = this.mockStore.partners.find(p => p.id === doc.partner_id);
      return {
        ...doc,
        partner: partner ? { name: partner.name, vat_number: partner.vat_number } : null
      };
    });
  }

  async getDocumentById(id: string): Promise<any> {
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const docRes = await client.from('documents').select(`*, partner:partners(*)`).eq('id', id).single();
      if (docRes.error) throw new NotFoundException('Documento non trovato');

      const itemsRes = await client
        .from('document_items')
        .select(`*, product:products(name, sku)`)
        .eq('document_id', id);

      const items = (itemsRes.data || []).map(item => ({
        ...item,
        product_name: item.product?.name,
        product_sku: item.product?.sku
      }));

      return {
        ...docRes.data,
        items
      };
    }

    const doc = this.mockStore.documents.find(d => d.id === id);
    if (!doc) throw new NotFoundException('Documento non trovato');
    const partner = this.mockStore.partners.find(p => p.id === doc.partner_id);
    const items = this.mockStore.documentItems
      .filter(item => item.document_id === id)
      .map(item => {
        const prod = this.mockStore.products.find(p => p.id === item.product_id);
        return {
          ...item,
          product_name: prod ? prod.name : 'Prodotto Sconosciuto',
          product_sku: prod ? prod.sku : ''
        };
      });

    return {
      ...doc,
      partner,
      items
    };
  }

  async saveDocument(docData: any): Promise<any> {
    const isEdit = !!docData.id;
    const items = docData.items || [];
    
    // Calculate total amount
    let totalNet = 0;
    let totalTax = 0;
    items.forEach((item: any) => {
      const qty = Number(item.quantity) || 0;
      const price = Number(item.unit_price) || 0;
      const discount = Number(item.discount_percent) || 0;
      const vat = Number(item.vat_percent) || 0;
      const lineNet = Number((qty * price * (1 - discount / 100)).toFixed(2));
      const lineTax = Number((lineNet * (vat / 100)).toFixed(2));
      totalNet += lineNet;
      totalTax += lineTax;
    });
    const totalAmount = Number((totalNet + totalTax).toFixed(2));

    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const payload = {
        type: docData.type,
        number: docData.number,
        date: docData.date,
        partner_id: docData.partner_id,
        status: docData.status || 'draft',
        total_amount: totalAmount,
        updated_at: new Date().toISOString()
      };

      let docResult;
      if (isEdit) {
        docResult = await client.from('documents').update(payload).eq('id', docData.id).select().single();
      } else {
        docResult = await client.from('documents').insert([payload]).select().single();
      }

      if (docResult.error) throw new BadRequestException(docResult.error.message);
      const documentId = docResult.data.id;

      // Handle items update
      if (isEdit) {
        const deleteRes = await client.from('document_items').delete().eq('document_id', documentId);
        if (deleteRes.error) throw new BadRequestException('Errore nella modifica delle righe del documento: ' + deleteRes.error.message);
      }

      if (items.length > 0) {
        const itemsPayload = items.map((item: any) => ({
          document_id: documentId,
          product_id: item.product_id,
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          discount_percent: Number(item.discount_percent) || 0.00,
          vat_percent: Number(item.vat_percent) || 22.00,
          lot_number: item.lot_number,
          expiry_date: item.expiry_date || null
        }));
        const itemsResult = await client.from('document_items').insert(itemsPayload);
        if (itemsResult.error) throw new BadRequestException('Errore inserimento righe: ' + itemsResult.error.message);
      }

      return this.getDocumentById(documentId);
    }

    // Mock implementation
    let savedDoc: Document;
    if (isEdit) {
      const idx = this.mockStore.documents.findIndex(d => d.id === docData.id);
      if (idx === -1) throw new NotFoundException('Documento non trovato');
      
      const oldDoc = this.mockStore.documents[idx];
      
      // Stock adjustment if status changed
      if (oldDoc.status === 'completed' && docData.status !== 'completed') {
        const oldItems = this.mockStore.documentItems.filter(item => item.document_id === oldDoc.id);
        this.mockStore.applyStockMovement(oldDoc, oldItems, 0); // reverse stock
      }

      savedDoc = {
        ...oldDoc,
        ...docData,
        total_amount: totalAmount,
        updated_at: new Date().toISOString()
      };
      this.mockStore.documents[idx] = savedDoc;

      // Update items
      this.mockStore.documentItems = this.mockStore.documentItems.filter(item => item.document_id !== docData.id);
    } else {
      savedDoc = {
        id: crypto.randomUUID(),
        type: docData.type,
        number: docData.number,
        date: docData.date,
        partner_id: docData.partner_id,
        status: docData.status || 'draft',
        total_amount: totalAmount,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.mockStore.documents.push(savedDoc);
    }

    const savedItems: DocumentItem[] = items.map((item: any) => {
      const newItem: DocumentItem = {
        id: crypto.randomUUID(),
        document_id: savedDoc.id,
        product_id: item.product_id,
        quantity: Number(item.quantity),
        unit_price: Number(item.unit_price),
        discount_percent: Number(item.discount_percent) || 0.00,
        vat_percent: Number(item.vat_percent) || 22.00,
        lot_number: item.lot_number,
        expiry_date: item.expiry_date,
        created_at: new Date().toISOString()
      };
      this.mockStore.documentItems.push(newItem);
      return newItem;
    });

    // Apply stock trigger if completed
    if (savedDoc.status === 'completed') {
      this.mockStore.applyStockMovement(savedDoc, savedItems, 1);
    }

    return {
      ...savedDoc,
      items: savedItems
    };
  }

  async updateDocumentStatus(id: string, status: 'draft' | 'completed' | 'cancelled'): Promise<any> {
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { data, error } = await client
        .from('documents')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw new BadRequestException(error.message);
      return this.getDocumentById(id);
    }

    // Mock
    const doc = this.mockStore.documents.find(d => d.id === id);
    if (!doc) throw new NotFoundException('Documento non trovato');
    
    const oldStatus = doc.status;
    if (oldStatus === status) return this.getDocumentById(id);

    const docItems = this.mockStore.documentItems.filter(item => item.document_id === id);

    // Transition OUT of completed
    if (oldStatus === 'completed') {
      this.mockStore.applyStockMovement(doc, docItems, 0); // reverse stock
    }

    doc.status = status;
    doc.updated_at = new Date().toISOString();

    // Transition INTO completed
    if (status === 'completed') {
      this.mockStore.applyStockMovement(doc, docItems, 1);
    }

    return this.getDocumentById(id);
  }

  async approveAllDrafts(): Promise<any> {
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { data: drafts, error: findError } = await client
        .from('documents')
        .select('id')
        .eq('status', 'draft');
      if (findError) throw new BadRequestException(findError.message);

      if (!drafts || drafts.length === 0) return { count: 0 };

      const { error: updateError } = await client
        .from('documents')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('status', 'draft');

      if (updateError) throw new BadRequestException(updateError.message);
      return { count: drafts.length };
    }

    const drafts = this.mockStore.documents.filter(d => d.status === 'draft');
    if (drafts.length === 0) return { count: 0 };

    drafts.forEach(doc => {
      const docItems = this.mockStore.documentItems.filter(item => item.document_id === doc.id);
      doc.status = 'completed';
      doc.updated_at = new Date().toISOString();
      this.mockStore.applyStockMovement(doc, docItems, 1);
    });

    return { count: drafts.length };
  }

  async deleteDocument(id: string): Promise<boolean> {
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { error } = await client.from('documents').delete().eq('id', id);
      if (error) throw new BadRequestException(error.message);
      return true;
    }

    const idx = this.mockStore.documents.findIndex(d => d.id === id);
    if (idx === -1) throw new NotFoundException('Documento non trovato');
    const doc = this.mockStore.documents[idx];
    
    // Reverse stock if it was completed
    if (doc.status === 'completed') {
      const docItems = this.mockStore.documentItems.filter(item => item.document_id === id);
      this.mockStore.applyStockMovement(doc, docItems, 0);
    }

    this.mockStore.documents.splice(idx, 1);
    this.mockStore.documentItems = this.mockStore.documentItems.filter(item => item.document_id !== id);
    return true;
  }

  // XML Invoice Importer
  async importXmlInvoice(xmlContent: string): Promise<any> {
    try {
      const parsed = parseXmlInvoice(xmlContent);
      const { supplierName, supplierVat, supplierAddress, docDate, docNumber, items } = parsed;

      // 1. Resolve Supplier
      let supplier: any = null;
      const partners = await this.partnersService.getPartners();
      const existingSupplier = partners.find(p => p.vat_number === supplierVat);
      if (existingSupplier) {
        supplier = existingSupplier;
      } else {
        supplier = await this.partnersService.savePartner({
          type: 'supplier',
          name: supplierName,
          vat_number: supplierVat,
          address: supplierAddress,
          sdi_code: '0000000',
        });
      }

      // 2. Prevent duplicates
      const docs = await this.getDocuments();
      const duplicateDoc = docs.find(d => d.partner_id === supplier.id && d.number === docNumber && d.type === 'invoice_purchase');
      if (duplicateDoc) {
        throw new BadRequestException(`La fattura n. ${docNumber} per il fornitore ${supplier.name} è già stata importata.`);
      }

      // 3. Process products and check similarity
      const products = await this.productsService.getProducts();
      const processedItems: any[] = [];

      for (const item of items) {
        const { sku, description, quantity, unit_price, discount_percent, vat_percent, format, vintage } = item;

        let product: any = null;
        const existingProduct = products.find(p => p.sku === sku);
        if (existingProduct) {
          product = existingProduct;
          const itemDiscountedCost = discount_percent > 0 && discount_percent < 100 ? Number((unit_price * (1 - discount_percent / 100)).toFixed(2)) : null;
          if (itemDiscountedCost && !product.discounted_cost) {
            await this.productsService.saveProduct({
              ...product,
              discounted_cost: itemDiscountedCost
            });
          }
        } else {
          const baseNew = getBaseSku(sku);
          let foundSimilar = false;
          if (baseNew && baseNew.length >= 3) {
            const similarProduct = products.find(p => {
              const baseExisting = getBaseSku(p.sku);
              return baseExisting && baseExisting === baseNew;
            });
            if (similarProduct) {
              product = similarProduct;
              foundSimilar = true;
              this.logger.log(`XML Importer: matched SKU "${sku}" to existing product "${similarProduct.name}" by base SKU.`);
            }
          }

          const itemDiscountedCost = discount_percent > 0 && discount_percent < 100 ? Number((unit_price * (1 - discount_percent / 100)).toFixed(2)) : null;
          if (foundSimilar) {
            if (itemDiscountedCost && !product.discounted_cost) {
              await this.productsService.saveProduct({
                ...product,
                discounted_cost: itemDiscountedCost
              });
            }
          } else {
            product = await this.productsService.saveProduct({
              sku,
              name: description,
              vintage,
              format,
              base_cost: unit_price,
              discounted_cost: itemDiscountedCost,
              markup_percent: 30.00,
              vat_percent,
              is_manual_price: false,
              stock_quantity: 0,
            });
          }
        }

        processedItems.push({
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          quantity,
          unit_price,
          discount_percent,
          vat_percent,
          lot_number: 'LOT-' + docDate.replace(/-/g, ''),
        });
      }

      // 4. Aggregation of duplicate lines
      const aggregatedItemsMap = new Map<string, any>();
      for (const item of processedItems) {
        const prodId = item.product_id;
        if (aggregatedItemsMap.has(prodId)) {
          const existing = aggregatedItemsMap.get(prodId);
          const newQty = existing.quantity + item.quantity;
          
          const existingNet = existing.quantity * existing.unit_price * (1 - existing.discount_percent / 100);
          const itemNet = item.quantity * item.unit_price * (1 - item.discount_percent / 100);
          const totalNet = existingNet + itemNet;
          
          const existingGross = existing.quantity * existing.unit_price;
          const itemGross = item.quantity * item.unit_price;
          const totalGross = existingGross + itemGross;
          
          const averageUnitPrice = totalGross / newQty;
          const effectiveDiscount = totalGross > 0 ? Number(((1 - totalNet / totalGross) * 100).toFixed(2)) : 0;
          
          existing.quantity = newQty;
          existing.unit_price = Number(averageUnitPrice.toFixed(2));
          existing.discount_percent = effectiveDiscount;
        } else {
          aggregatedItemsMap.set(prodId, { ...item });
        }
      }
      const aggregatedItems = Array.from(aggregatedItemsMap.values());

      // 5. Save Document in Draft status
      const newDocument = await this.saveDocument({
        type: 'invoice_purchase',
        number: docNumber,
        date: docDate,
        partner_id: supplier.id,
        status: 'draft',
        items: aggregatedItems,
      });

      return newDocument;
    } catch (err) {
      this.logger.error('Failed to import XML Invoice:', err);
      throw new BadRequestException(err instanceof BadRequestException ? err.message : 'Errore durante l\'importazione del file XML: ' + (err?.message || err));
    }
  }

  // SIAN & Accise Exports
  async exportSianXml(documentId: string): Promise<string> {
    const doc = await this.getDocumentById(documentId);
    if (!doc.items || doc.items.length === 0) {
      throw new BadRequestException('Il documento non ha articoli da dichiarare.');
    }
    
    const firstItem = doc.items[0];
    const xml = this.sianService.generateSianXml({
      id: doc.id,
      operationType: doc.type === 'invoice_purchase' || doc.type === 'ddt_in' ? 'ARRICCHIMENTO' : 'DECLASSAMENTO',
      date: doc.date,
      productSku: firstItem.product_sku || 'SKU-UNKNOWN',
      quantityLiters: firstItem.quantity * 0.75,
      alcoholVolume: 12.50,
      lotNumber: firstItem.lot_number || 'LOT-MOCK'
    });
    return xml;
  }

  async exportAcciseXml(documentId: string): Promise<string> {
    const doc = await this.getDocumentById(documentId);
    if (!doc.items || doc.items.length === 0) {
      throw new BadRequestException('Il documento non ha articoli per il tracciato e-AD.');
    }
    const firstItem = doc.items[0];
    const xml = this.acciseService.generateEadXml({
      id: doc.id,
      senderAcciseCode: 'IT00CANTINAPRIV1',
      receiverAcciseCode: doc.partner?.sdi_code || 'ITDOGANATX000',
      transporterName: doc.partner?.name || 'VETTORE LOGISTICO',
      wineType: 'SPUMANTE',
      quantityLiters: firstItem.quantity * 0.75,
      alcoholVolume: 12.00,
      cnCode: '22042180',
      grossWeightKg: firstItem.quantity * 1.3,
      netWeightKg: firstItem.quantity * 0.75
    });
    return xml;
  }

  // CBI Bank reconciliation
  async reconcileBankFile(fileContent: string): Promise<any[]> {
    const transactions = this.reconciliationService.parseCbiFile(fileContent);
    const documentsList = await this.getDocuments();
    const openInvoices = documentsList.filter(d => d.status !== 'cancelled');
    
    const results = this.reconciliationService.reconcileTransactions(transactions, openInvoices);

    for (const res of results) {
      if (res.status === 'reconciled' && res.matchedInvoiceId) {
        this.logger.log(`Autoconciliato pagamento per fattura ${res.matchedInvoiceNumber}`);
      }
    }

    return results;
  }
}
