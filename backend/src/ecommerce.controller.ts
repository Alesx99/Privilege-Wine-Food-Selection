import { Controller, Post, Body, Headers, BadRequestException, HttpCode, Logger } from '@nestjs/common';
import { AppService } from './app.service';

@Controller('api/ecommerce')
export class EcommerceController {
  private readonly logger = new Logger(EcommerceController.name);

  constructor(private readonly appService: AppService) {}

  /**
   * Webhook per ricevere ordini da WooCommerce.
   * Scarica automaticamente lo stock di magazzino e crea un ordine cliente.
   */
  @Post('woocommerce/webhook')
  @HttpCode(200)
  async handleWooCommerceWebhook(
    @Body() payload: any,
    @Headers('x-wc-webhook-topic') topic: string,
    @Headers('x-wc-webhook-signature') signature: string,
  ) {
    this.logger.log(`Ricevuto webhook WooCommerce con topic: ${topic}`);

    // Verifica minima del topic dell'ordine
    if (!topic || !topic.includes('order.created')) {
      return { status: 'skipped', message: 'Topic non rilevante per il magazzino.' };
    }

    try {
      const orderId = payload.id;
      const customerEmail = payload.billing?.email;
      const customerName = `${payload.billing?.first_name} ${payload.billing?.last_name}`.trim();
      const items = payload.line_items || [];

      this.logger.log(`Elaborazione Ordine WooCommerce #${orderId} da parte di ${customerName}`);

      // Mappatura articoli WooCommerce su prodotti ERP
      const erpItems = [];
      for (const item of items) {
        const sku = item.sku; // WooCommerce SKU corrisponde al nostro SKU prodotto
        const qty = Number(item.quantity) || 0;
        const price = Number(item.price) || 0;

        if (!sku) {
          throw new BadRequestException(`SKU mancante per l'articolo ${item.name} nell'ordine WooCommerce.`);
        }

        // Recuperiamo il prodotto dal gestionale per SKU
        const products = await this.appService.getProducts();
        const product = products.find(p => p.sku === sku);

        if (!product) {
          this.logger.warn(`Prodotto con SKU "${sku}" non trovato nel magazzino dell'ERP. Saltato.`);
          continue;
        }

        erpItems.push({
          product_id: product.id,
          quantity: qty,
          unit_price: price,
          discount_percent: 0.00,
          vat_percent: product.vat_percent || 22.00
        });
      }

      if (erpItems.length === 0) {
        return { status: 'warning', message: 'Nessun prodotto dell\'ordine mappato sull\'ERP.' };
      }

      // Ricerchiamo o creiamo il Partner e-commerce
      const partners = await this.appService.getPartners();
      let customer = partners.find(p => p.email === customerEmail || p.name === customerName);

      if (!customer) {
        customer = await this.appService.savePartner({
          type: 'client',
          name: customerName || `CLIENTE WEB #${orderId}`,
          vat_number: '00000000000', // P.IVA generica consumatore finale
          tax_code: '',
          sdi_code: '0000000',
          email: customerEmail,
          address: `${payload.billing?.address_1}, ${payload.billing?.postcode} ${payload.billing?.city}`,
          phone: payload.billing?.phone
        });
      }

      // Creazione automatica del documento d'ordine sul gestionale
      const newDoc = await this.appService.saveDocument({
        type: 'ddt_out', // Viene emesso come DDT in uscita per la logistica
        number: `WOO-${orderId}`,
        date: new Date().toISOString().split('T')[0],
        partner_id: customer.id,
        status: 'completed', // Lo impostiamo direttamente a completed per scalare subito lo stock di magazzino
        items: erpItems
      });

      this.logger.log(`Ordine WooCommerce #${orderId} inserito nell'ERP con ID documento: ${newDoc.id}`);
      return { status: 'success', documentId: newDoc.id, number: newDoc.number };
    } catch (err) {
      this.logger.error('Errore durante l\'elaborazione del webhook WooCommerce:', err);
      throw new BadRequestException('Errore nel processamento dell\'ordine: ' + err.message);
    }
  }

  /**
   * Webhook per ricevere ordini da Shopify.
   */
  @Post('shopify/webhook')
  @HttpCode(200)
  async handleShopifyWebhook(
    @Body() payload: any,
    @Headers('x-shopify-topic') topic: string,
  ) {
    this.logger.log(`Ricevuto webhook Shopify con topic: ${topic}`);

    if (topic !== 'orders/create') {
      return { status: 'skipped', message: 'Topic non gestito.' };
    }

    // Struttura analoga a WooCommerce per mappare i prodotti Shopify tramite SKU
    return { status: 'received', provider: 'shopify', orderId: payload.id };
  }
}
