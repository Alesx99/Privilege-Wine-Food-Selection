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
    const clean = sku.trim().toUpperCase();
    let base = clean.replace(/[-/_.]+[A-Z0-9]{1,2}$/, '');
    base = base.replace(/([0-9]+)[A-Z]{1,2}$/, '$1');
    return base;
  }

  async getProductBySkuOrAlias(sku: string): Promise<any | null> {
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      // Cerca per SKU diretto
      const { data: directData } = await client
        .from('products')
        .select('*')
        .eq('sku', sku)
        .maybeSingle();
      
      if (directData) return directData;
      
      // Cerca nella tabella degli alias
      const { data: aliasData } = await client
        .from('product_sku_aliases')
        .select('product_id')
        .eq('sku', sku)
        .maybeSingle();
      
      if (aliasData) {
        return this.getProductById(aliasData.product_id);
      }
      return null;
    }
    
    // Mock DB locale
    const directProd = this.mockStore.products.find(p => p.sku === sku);
    if (directProd) return directProd;
    
    const alias = this.mockStore.productSkuAliases.find(a => a.sku === sku);
    if (alias) {
      return this.mockStore.products.find(p => p.id === alias.product_id) || null;
    }
    return null;
  }

  async mergeProducts(targetProductId: string, sourceProductId: string): Promise<any> {
    if (targetProductId === sourceProductId) {
      throw new BadRequestException('Impossibile unire un prodotto con se stesso.');
    }

    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();

      // Invoca la funzione PostgreSQL transazionale tramite RPC (Criticità #1)
      const { error } = await client.rpc('merge_products', {
        target_id: targetProductId,
        source_id: sourceProductId,
      });

      if (error) {
        throw new BadRequestException('Errore durante la fusione transazionale del prodotto: ' + error.message);
      }

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

    // Archivia lo SKU alias locale in memoria (Criticità #2)
    this.mockStore.productSkuAliases.push({
      id: crypto.randomUUID(),
      product_id: targetProductId,
      sku: sourceProduct.sku,
      created_at: new Date().toISOString()
    });

    // Sposta eventuali alias preesistenti associati al sorgente verso il target
    this.mockStore.productSkuAliases = this.mockStore.productSkuAliases.map(alias => {
      if (alias.product_id === sourceProductId) {
        return { ...alias, product_id: targetProductId };
      }
      return alias;
    });

    this.mockStore.products = this.mockStore.products.filter(p => p.id !== sourceProductId);
    this.mockStore.recalculateProductPrices();

    return { success: true, mergedInto: targetProductId };
  }
}
