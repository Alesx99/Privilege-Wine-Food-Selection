import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from './supabase.service';
import { MockStore, Partner } from './mock-store';
import { ProductsService } from './products.service';

@Injectable()
export class PartnersService {
  private readonly logger = new Logger(PartnersService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly mockStore: MockStore,
    private readonly productsService: ProductsService,
  ) {}

  private useSupabase(): boolean {
    return this.supabaseService.isInitialized();
  }

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
  // LISTINI & CALCOLO PREZZI
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
    if (this.useSupabase()) {
      const client = this.supabaseService.getClient();
      const { data, error } = await client.rpc('get_partner_product_price', {
        p_partner_id: partnerId,
        p_product_id: productId,
      });
      if (error) throw new BadRequestException(error.message);

      // We also need the product VAT to calculate gross price
      const prod = await this.productsService.getProductById(productId);
      const priceNet = Number(data);
      const priceGross = Number((priceNet * (1 + prod.vat_percent / 100)).toFixed(2));

      return {
        price_net: priceNet,
        price_gross: priceGross,
        vat_percent: prod.vat_percent
      };
    }

    // Mock implementation
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
}
