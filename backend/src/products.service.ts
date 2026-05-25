import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { MockStore, Product } from './mock-store';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mockStore: MockStore,
  ) {}

  private useSupabase(): boolean {
    return this.supabaseService.isInitialized();
  }

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

  getBaseSku(sku: string): string {
    if (!sku) return '';
    return sku.trim().toUpperCase().replace(/[-/_.]?[a-zA-Z0-9]{1,2}$/, '');
  }

  async mergeProducts(targetProductId: string, sourceProductId: string): Promise<any> {
    if (targetProductId === sourceProductId) {
      throw new BadRequestException('Impossibile unire un prodotto con se stesso.');
    }

    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();

      const { data: targetProduct, error: targetError } = await client
        .from('products')
        .select('*')
        .eq('id', targetProductId)
        .single();
      const { data: sourceProduct, error: sourceError } = await client
        .from('products')
        .select('*')
        .eq('id', sourceProductId)
        .single();

      if (targetError || !targetProduct) throw new NotFoundException('Prodotto di destinazione non trovato');
      if (sourceError || !sourceProduct) throw new NotFoundException('Prodotto sorgente non trovato');

      // Trova tutti i documenti completed associati al prodotto sorgente
      const { data: affectedItems, error: itemsErr } = await client
        .from('document_items')
        .select('document_id')
        .eq('product_id', sourceProductId);
      
      if (itemsErr) throw new BadRequestException(itemsErr.message);

      const docIds = Array.from(new Set(affectedItems?.map(item => item.document_id) || []));

      let completedDocIds: string[] = [];
      if (docIds.length > 0) {
        const { data: affectedDocs, error: docsErr } = await client
          .from('documents')
          .select('id, status')
          .in('id', docIds);
        
        if (docsErr) throw new BadRequestException(docsErr.message);
        completedDocIds = affectedDocs?.filter(d => d.status === 'completed').map(d => d.id) || [];
      }

      // 1. Riporta a bozze i documenti completati coinvolti
      for (const docId of completedDocIds) {
        const { error: updateErr } = await client
          .from('documents')
          .update({ status: 'draft', updated_at: new Date().toISOString() })
          .eq('id', docId);
        if (updateErr) throw new BadRequestException(`Errore ripristino bozza per documento ${docId}: ` + updateErr.message);
      }

      // 2. Modifica il product_id in document_items per tutte le righe collegate a sourceProductId
      const { error: updateItemsErr } = await client
        .from('document_items')
        .update({ product_id: targetProductId })
        .eq('product_id', sourceProductId);
      
      if (updateItemsErr) throw new BadRequestException('Errore aggiornamento righe documento: ' + updateItemsErr.message);

      // 3. Riporta a completato i documenti
      for (const docId of completedDocIds) {
        const { error: updateErr } = await client
          .from('documents')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .eq('id', docId);
        if (updateErr) throw new BadRequestException(`Errore ricompletamento documento ${docId}: ` + updateErr.message);
      }

      // 4. Aggiorna giacenze multi-deposito in warehouse_stock
      const { data: sourceWhStock, error: sourceWhStockErr } = await client
        .from('warehouse_stock')
        .select('*')
        .eq('product_id', sourceProductId);
      
      if (sourceWhStockErr) throw new BadRequestException(sourceWhStockErr.message);

      for (const sourceStock of sourceWhStock || []) {
        const { data: targetStock, error: targetStockErr } = await client
          .from('warehouse_stock')
          .select('*')
          .eq('product_id', targetProductId)
          .eq('warehouse_id', sourceStock.warehouse_id)
          .maybeSingle();

        if (targetStock) {
          const newQty = (targetStock.stock_quantity || 0) + (sourceStock.stock_quantity || 0);
          await client
            .from('warehouse_stock')
            .update({ stock_quantity: newQty, updated_at: new Date().toISOString() })
            .eq('product_id', targetProductId)
            .eq('warehouse_id', sourceStock.warehouse_id);
          
          await client
            .from('warehouse_stock')
            .delete()
            .eq('product_id', sourceProductId)
            .eq('warehouse_id', sourceStock.warehouse_id);
        } else {
          await client
            .from('warehouse_stock')
            .update({ product_id: targetProductId, updated_at: new Date().toISOString() })
            .eq('product_id', sourceProductId)
            .eq('warehouse_id', sourceStock.warehouse_id);
        }
      }

      // 5. Aggiorna stock totale consolidato su products
      const newTotalStock = (targetProduct.stock_quantity || 0) + (sourceProduct.stock_quantity || 0);
      const { error: finalProductErr } = await client
        .from('products')
        .update({ stock_quantity: newTotalStock, updated_at: new Date().toISOString() })
        .eq('id', targetProductId);
      
      if (finalProductErr) throw new BadRequestException(finalProductErr.message);

      // 6. Elimina il prodotto sorgente
      const { error: deleteProductErr } = await client
        .from('products')
        .delete()
        .eq('id', sourceProductId);
      
      if (deleteProductErr) throw new BadRequestException('Errore eliminazione prodotto sorgente: ' + deleteProductErr.message);

      return { success: true, mergedInto: targetProductId };
    }

    // Mock DB locale
    const targetProduct = this.mockStore.products.find(p => p.id === targetProductId);
    const sourceProduct = this.mockStore.products.find(p => p.id === sourceProductId);

    if (!targetProduct) throw new NotFoundException('Prodotto di destinazione non trovato');
    if (!sourceProduct) throw new NotFoundException('Prodotto sorgente non trovato');

    this.mockStore.documentItems = this.mockStore.documentItems.map(item => {
      if (item.product_id === sourceProductId) {
        return { ...item, product_id: targetProductId };
      }
      return item;
    });

    const sourceStocks = this.mockStore.warehouseStock.filter(ws => ws.product_id === sourceProductId);
    sourceStocks.forEach(sourceStock => {
      const targetStock = this.mockStore.warehouseStock.find(
        ws => ws.product_id === targetProductId && ws.warehouse_id === sourceStock.warehouse_id
      );
      if (targetStock) {
        targetStock.stock_quantity += sourceStock.stock_quantity;
        targetStock.updated_at = new Date().toISOString();
      } else {
        this.mockStore.warehouseStock.push({
          product_id: targetProductId,
          warehouse_id: sourceStock.warehouse_id,
          stock_quantity: sourceStock.stock_quantity,
          updated_at: new Date().toISOString()
        });
      }
    });

    this.mockStore.warehouseStock = this.mockStore.warehouseStock.filter(ws => ws.product_id !== sourceProductId);

    targetProduct.stock_quantity += sourceProduct.stock_quantity;
    targetProduct.updated_at = new Date().toISOString();

    this.mockStore.products = this.mockStore.products.filter(p => p.id !== sourceProductId);
    this.mockStore.recalculateProductPrices();

    return { success: true, mergedInto: targetProductId };
  }
}
