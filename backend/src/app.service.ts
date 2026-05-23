import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { MockStore, Product, Partner, PriceList, Document, DocumentItem } from './mock-store';

@Injectable()
export class AppService {
  private readonly logger = new Logger(AppService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mockStore: MockStore,
  ) {}

  // --- HELPER DI SUPABASE ---
  private useSupabase(): boolean {
    return this.supabaseService.isInitialized();
  }

  // ==========================================
  // 1. MODULO PRODOTTI
  // ==========================================
  async getProducts(): Promise<any[]> {
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { data, error } = await client
        .from('products')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw new BadRequestException(error.message);
      return data;
    }
    return this.mockStore.products;
  }

  async getProductById(id: string): Promise<any> {
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { data, error } = await client
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw new NotFoundException('Prodotto non trovato');
      return data;
    }
    const product = this.mockStore.products.find(p => p.id === id);
    if (!product) throw new NotFoundException('Prodotto non trovato');
    return product;
  }

  async saveProduct(productData: any): Promise<any> {
    const isEdit = !!productData.id;
    
    // Calc generated fields (if local)
    const baseCost = Number(productData.base_cost) || 0;
    const discountedCost = productData.discounted_cost !== null && productData.discounted_cost !== undefined && productData.discounted_cost !== '' ? Number(productData.discounted_cost) : null;
    const markup = Number(productData.markup_percent) || 0;
    const vat = Number(productData.vat_percent) || 0;
    const isManual = !!productData.is_manual_price;
    const manualPrice = productData.manual_price !== null && productData.manual_price !== undefined ? Number(productData.manual_price) : null;

    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const payload = {
        sku: productData.sku,
        name: productData.name,
        vintage: productData.vintage || 'NV',
        format: productData.format || '0.75L',
        base_cost: baseCost,
        discounted_cost: discountedCost,
        markup_percent: markup,
        vat_percent: vat,
        is_manual_price: isManual,
        manual_price: manualPrice,
        stock_quantity: Number(productData.stock_quantity) || 0,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (isEdit) {
        result = await client.from('products').update(payload).eq('id', productData.id).select().single();
      } else {
        result = await client.from('products').insert([payload]).select().single();
      }
      if (result.error) throw new BadRequestException(result.error.message);
      return result.data;
    }

    // Local Mock DB
    if (isEdit) {
      const idx = this.mockStore.products.findIndex(p => p.id === productData.id);
      if (idx === -1) throw new NotFoundException('Prodotto non trovato');
      const currentProd = this.mockStore.products[idx];
      this.mockStore.products[idx] = {
        ...currentProd,
        ...productData,
        base_cost: baseCost,
        discounted_cost: discountedCost,
        markup_percent: markup,
        vat_percent: vat,
        is_manual_price: isManual,
        manual_price: manualPrice,
        stock_quantity: Number(productData.stock_quantity) || 0,
        updated_at: new Date().toISOString(),
      };
      this.mockStore.recalculateProductPrices();
      return this.mockStore.products[idx];
    } else {
      const newProd: Product = {
        id: crypto.randomUUID(),
        sku: productData.sku,
        name: productData.name,
        vintage: productData.vintage || 'NV',
        format: productData.format || '0.75L',
        base_cost: baseCost,
        discounted_cost: discountedCost,
        markup_percent: markup,
        vat_percent: vat,
        is_manual_price: isManual,
        manual_price: manualPrice,
        stock_quantity: Number(productData.stock_quantity) || 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.mockStore.products.push(newProd);
      this.mockStore.recalculateProductPrices();
      return newProd;
    }
  }

  async deleteProduct(id: string): Promise<boolean> {
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { error } = await client.from('products').delete().eq('id', id);
      if (error) throw new BadRequestException(error.message);
      return true;
    }

    const idx = this.mockStore.products.findIndex(p => p.id === id);
    if (idx === -1) throw new NotFoundException('Prodotto non trovato');
    this.mockStore.products.splice(idx, 1);
    return true;
  }

  // ==========================================
  // 2. MODULO PARTNER (ANAGRAFICHE)
  // ==========================================
  async getPartners(): Promise<any[]> {
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { data, error } = await client
        .from('partners')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw new BadRequestException(error.message);
      return data;
    }
    return this.mockStore.partners;
  }

  async savePartner(partnerData: any): Promise<any> {
    const isEdit = !!partnerData.id;
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const payload = {
        type: partnerData.type,
        name: partnerData.name,
        vat_number: partnerData.vat_number,
        tax_code: partnerData.tax_code,
        sdi_code: partnerData.sdi_code || '0000000',
        email: partnerData.email,
        address: partnerData.address,
        phone: partnerData.phone,
        updated_at: new Date().toISOString(),
      };

      let result;
      if (isEdit) {
        result = await client.from('partners').update(payload).eq('id', partnerData.id).select().single();
      } else {
        result = await client.from('partners').insert([payload]).select().single();
      }
      if (result.error) throw new BadRequestException(result.error.message);
      
      // Update price list association
      if (partnerData.price_list_id) {
        await client.from('partner_price_lists').upsert({
          partner_id: result.data.id,
          price_list_id: partnerData.price_list_id
        });
      } else {
        await client.from('partner_price_lists').delete().eq('partner_id', result.data.id);
      }

      return { ...result.data, price_list_id: partnerData.price_list_id };
    }

    // Mock
    if (isEdit) {
      const idx = this.mockStore.partners.findIndex(p => p.id === partnerData.id);
      if (idx === -1) throw new NotFoundException('Partner non trovato');
      this.mockStore.partners[idx] = {
        ...this.mockStore.partners[idx],
        ...partnerData,
      };
      if (partnerData.price_list_id) {
        this.mockStore.partnerPriceLists[partnerData.id] = partnerData.price_list_id;
      } else {
        delete this.mockStore.partnerPriceLists[partnerData.id];
      }
      return this.mockStore.partners[idx];
    } else {
      const newPartner: Partner = {
        id: crypto.randomUUID(),
        type: partnerData.type,
        name: partnerData.name,
        vat_number: partnerData.vat_number,
        tax_code: partnerData.tax_code,
        sdi_code: partnerData.sdi_code || '0000000',
        email: partnerData.email,
        address: partnerData.address,
        phone: partnerData.phone,
        created_at: new Date().toISOString(),
      };
      this.mockStore.partners.push(newPartner);
      if (partnerData.price_list_id) {
        this.mockStore.partnerPriceLists[newPartner.id] = partnerData.price_list_id;
      }
      return { ...newPartner, price_list_id: partnerData.price_list_id };
    }
  }

  async deletePartner(id: string): Promise<boolean> {
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { error } = await client.from('partners').delete().eq('id', id);
      if (error) throw new BadRequestException(error.message);
      return true;
    }
    const idx = this.mockStore.partners.findIndex(p => p.id === id);
    if (idx === -1) throw new NotFoundException('Partner non trovato');
    this.mockStore.partners.splice(idx, 1);
    delete this.mockStore.partnerPriceLists[id];
    return true;
  }

  // ==========================================
  // 3. LISTINI & CALCOLO PREZZI
  // ==========================================
  async getPriceLists(): Promise<any[]> {
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { data, error } = await client.from('price_lists').select('*');
      if (error) throw new BadRequestException(error.message);
      return data;
    }
    return this.mockStore.priceLists;
  }

  async calculatePartnerProductPrice(partnerId: string, productId: string): Promise<any> {
    // If Supabase is active, we can call the SQL function
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { data, error } = await client.rpc('get_partner_product_price', {
        p_partner_id: partnerId,
        p_product_id: productId,
      });
      if (error) throw new BadRequestException(error.message);

      // We also need the product VAT to calculate gross price
      const prod = await this.getProductById(productId);
      const priceNet = Number(data);
      const priceGross = Number((priceNet * (1 + prod.vat_percent / 100)).toFixed(2));

      return {
        price_net: priceNet,
        price_gross: priceGross,
        vat_percent: prod.vat_percent
      };
    }

    // Mock implementation of price resolution
    const prod = this.mockStore.products.find(p => p.id === productId);
    if (!prod) throw new NotFoundException('Prodotto non trovato');

    if (prod.is_manual_price) {
      const net = prod.manual_price || 0;
      return {
        price_net: net,
        price_gross: Number((net * (1 + prod.vat_percent / 100)).toFixed(2)),
        vat_percent: prod.vat_percent
      };
    }

    const priceListId = this.mockStore.partnerPriceLists[partnerId];
    const priceList = this.mockStore.priceLists.find(pl => pl.id === priceListId);
    const markup = priceList ? priceList.markup_percent : prod.markup_percent;
    const cost = prod.discounted_cost !== null && prod.discounted_cost !== undefined ? prod.discounted_cost : prod.base_cost;
    const net = Number((cost * (1 + markup / 100)).toFixed(2));

    return {
      price_net: net,
      price_gross: Number((net * (1 + prod.vat_percent / 100)).toFixed(2)),
      vat_percent: prod.vat_percent
    };
  }

  // ==========================================
  // 4. MODULO DOCUMENTI
  // ==========================================
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
        // If document was completed, PG trigger blocks editing items.
        // We'll update the document status and check errors.
        docResult = await client.from('documents').update(payload).eq('id', docData.id).select().single();
      } else {
        docResult = await client.from('documents').insert([payload]).select().single();
      }

      if (docResult.error) throw new BadRequestException(docResult.error.message);
      const documentId = docResult.data.id;

      // Handle items update
      if (isEdit) {
        // Clear old items and write new ones (triggers will fail if document remains 'completed')
        // Hence, the frontend should set status to 'draft', save, then set status to 'completed'
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

      // Re-fetch to return full state
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

  // ==========================================
  // 5. IMPORT AREA (FATTURA XML FANTASY PARSING)
  // ==========================================
  async importXmlInvoice(xmlContent: string): Promise<any> {
    try {
      // Helper to find a tag value with optional namespace prefix
      const getTagValue = (xml: string, tag: string): string => {
        if (!xml) return '';
        const regex = new RegExp(`<([a-zA-Z0-9]+:)?${tag}\\b[^>]*>([^<]*)<\\/\\1?${tag}>`, 'i');
        const match = xml.match(regex);
        return match ? match[2].trim() : '';
      };

      // Helper to extract a section with optional namespace prefix
      const getSection = (xml: string, tag: string): string => {
        if (!xml) return '';
        const regex = new RegExp(`<([a-zA-Z0-9]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/\\1?${tag}>`, 'i');
        const match = xml.match(regex);
        return match ? match[2] : '';
      };

      // Extract Supplier (CedentePrestatore)
      const cedenteSection = getSection(xmlContent, 'CedentePrestatore');
      const supplierName = getTagValue(cedenteSection, 'Denominazione');
      const supplierVat = getTagValue(cedenteSection, 'IdCodice');
      const supplierAddress = getTagValue(cedenteSection, 'Indirizzo') + ', ' + getTagValue(cedenteSection, 'CAP') + ' ' + getTagValue(cedenteSection, 'Comune');

      // Extract Document Headers (FatturaElettronicaBody)
      const bodySection = getSection(xmlContent, 'FatturaElettronicaBody');
      const docDate = getTagValue(bodySection, 'Data');
      const docNumber = getTagValue(bodySection, 'Numero');

      const finalDocDate = docDate || new Date().toISOString().split('T')[0];

      if (!supplierVat || !docNumber) {
        throw new BadRequestException('Formato XML Fattura Elettronica non valido o non riconosciuto (Partita IVA o Numero documento mancanti).');
      }

      // Check if Supplier exists, if not create
      let supplier: any = null;
      const partners = await this.getPartners();
      const existingSupplier = partners.find(p => p.vat_number === supplierVat);
      if (existingSupplier) {
        supplier = existingSupplier;
      } else {
        supplier = await this.savePartner({
          type: 'supplier',
          name: supplierName || 'FORNITORE IMPORTATO',
          vat_number: supplierVat,
          address: supplierAddress || 'Indirizzo non specificato',
          sdi_code: '0000000',
        });
      }

      // Check if Document already exists (prevent duplicate imports)
      const docs = await this.getDocuments();
      const duplicateDoc = docs.find(d => d.partner_id === supplier.id && d.number === docNumber && d.type === 'invoice_purchase');
      if (duplicateDoc) {
        throw new BadRequestException(`La fattura n. ${docNumber} per il fornitore ${supplier.name} è già stata importata.`);
      }

      // Extract Items using regex to match DettaglioLinee (robust against namespaces)
      const items: any[] = [];
      const detailRegex = /<([a-zA-Z0-9]+:)?DettaglioLinee\b[^>]*>([\s\S]*?)<\/\1?DettaglioLinee>/gi;
      const detailMatches = [...xmlContent.matchAll(detailRegex)];

      for (const match of detailMatches) {
        const cleanedLine = match[2];
        const desc = getTagValue(cleanedLine, 'Descrizione');
        const qty = Number(getTagValue(cleanedLine, 'Quantita')) || 0;
        const price = Number(getTagValue(cleanedLine, 'PrezzoUnitario')) || 0;
        const vat = Number(getTagValue(cleanedLine, 'AliquotaIVA')) || 22.00;

        // Discount percent extraction
        let discount = 0;
        const scontoSection = getSection(cleanedLine, 'ScontoMaggiorazione');
        if (scontoSection) {
          discount = Number(getTagValue(scontoSection, 'Percentuale')) || 0;
        }

        // We skip informational lines (0 qty or 0 price) unless it's a 100% discount free item
        if (qty === 0 || (price === 0 && discount < 100)) {
          continue;
        }

        // Extract SKU from supplier code or general article code (robust against namespaces)
        let sku = '';
        const codiceArticoloRegex = /<([a-zA-Z0-9]+:)?CodiceArticolo\b[^>]*>([\s\S]*?)<\/\1?CodiceArticolo>/gi;
        const artMatches = [...cleanedLine.matchAll(codiceArticoloRegex)];
        
        for (const artMatch of artMatches) {
          const artSection = artMatch[2];
          const tipo = getTagValue(artSection, 'CodiceTipo');
          const valore = getTagValue(artSection, 'CodiceValore');
          if (tipo.toLowerCase().includes('fornitore')) {
            sku = valore;
            break;
          }
        }
        
        // If not found, use the first CodiceArticolo value as fallback
        if (!sku && artMatches.length > 0) {
          sku = getTagValue(artMatches[0][2], 'CodiceValore');
        }

        if (!sku) {
          // generate temporary SKU if empty
          sku = 'IMP-' + Math.random().toString(36).substring(2, 8).toUpperCase();
        }

        // Try parsing vintage and format from description (e.g. "LT.0,75", "2019", "MAGNUM")
        let format = '0.75L';
        if (desc.toLowerCase().includes('magnum') || desc.toLowerCase().includes('1,5') || desc.toLowerCase().includes('1.5')) {
          format = '1.5L';
        } else if (desc.toLowerCase().includes('0,375') || desc.toLowerCase().includes('0.375')) {
          format = '0.375L';
        }

        let vintage = 'NV';
        const yearMatch = desc.match(/\b(19|20)\d{2}\b/);
        if (yearMatch) {
          vintage = yearMatch[0];
        }

        // Check if product exists by SKU, if not create
        let product: any = null;
        const products = await this.getProducts();
        const existingProduct = products.find(p => p.sku === sku);
        if (existingProduct) {
          product = existingProduct;
          // Se il prodotto esiste ma non ha un costo scontato registrato ed ora l'abbiamo rilevato, aggiorniamolo
          const itemDiscountedCost = discount > 0 && discount < 100 ? Number((price * (1 - discount / 100)).toFixed(2)) : null;
          if (itemDiscountedCost && !product.discounted_cost) {
            await this.saveProduct({
              ...product,
              discounted_cost: itemDiscountedCost
            });
          }
        } else {
          const itemDiscountedCost = discount > 0 && discount < 100 ? Number((price * (1 - discount / 100)).toFixed(2)) : null;
          product = await this.saveProduct({
            sku,
            name: desc,
            vintage,
            format,
            base_cost: price,
            discounted_cost: itemDiscountedCost,
            markup_percent: 30.00,
            vat_percent: vat,
            is_manual_price: false,
            stock_quantity: 0,
          });
        }

        items.push({
          product_id: product.id,
          product_name: product.name,
          product_sku: product.sku,
          quantity: qty,
          unit_price: price,
          discount_percent: discount,
          vat_percent: vat,
          lot_number: 'LOT-' + finalDocDate.replace(/-/g, ''),
        });
      }

      // Create Document in Draft status
      const newDocument = await this.saveDocument({
        type: 'invoice_purchase',
        number: docNumber,
        date: finalDocDate,
        partner_id: supplier.id,
        status: 'draft', // Saved as draft so user can review it before completing
        items,
      });

      return newDocument;
    } catch (err) {
      this.logger.error('Failed to import XML Invoice:', err);
      throw new BadRequestException(err instanceof BadRequestException ? err.message : 'Errore durante l\'importazione del file XML: ' + (err?.message || err));
    }
  }
}
