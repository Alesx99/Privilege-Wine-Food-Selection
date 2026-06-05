import { Injectable } from '@nestjs/common';

export interface Product {
  id: string;
  sku: string;
  name: string;
  vintage: string;
  format: string;
  base_cost: number;
  discounted_cost: number | null;
  markup_percent: number;
  vat_percent: number;
  is_manual_price: boolean;
  manual_price: number | null;
  stock_quantity: number;
  selling_price_net?: number;
  selling_price_gross?: number;
  created_at: string;
  updated_at: string;
}

export interface PriceList {
  id: string;
  name: string;
  markup_percent: number;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  document_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount_percent: number;
  vat_percent: number;
  lot_number?: string;
  expiry_date?: string;
  created_at: string;
}


export interface Warehouse {
  id: string;
  code: string;
  name: string;
  location: string;
  created_at: string;
}

export interface WarehouseStock {
  product_id: string;
  warehouse_id: string;
  stock_quantity: number;
  updated_at: string;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  phone?: string;
  vat_number?: string;
  default_commission_percent: number;
  created_at: string;
  password?: string;
}

export interface ProductSuggestion {
  id: string;
  agent_id: string | null;
  product_name: string;
  winery: string;
  price_list: string;
  recommended_price: number;
  notes?: string;
  status: 'pending' | 'accepted' | 'refused';
  created_at: string;
}


export interface AgentCommission {
  id: string;
  agent_id: string;
  document_id: string;
  amount: number;
  commission_percent: number;
  status: 'unpaid' | 'paid' | 'cancelled';
  calculated_at: string;
}

export interface Partner {
  id: string;
  type: 'client' | 'supplier' | 'both';
  name: string;
  vat_number: string;
  tax_code?: string;
  sdi_code: string;
  email?: string;
  address?: string;
  phone?: string;
  agent_id?: string; // Associated agent
  created_at: string;
  password?: string;
}

export interface ProductSkuAlias {
  id: string;
  product_id: string;
  sku: string;
  created_at: string;
}

export interface Document {
  id: string;
  type: 'order_supplier' | 'ddt_in' | 'ddt_out' | 'stock_load' | 'invoice_sale' | 'invoice_purchase';
  number: string;
  date: string;
  partner_id: string;
  warehouse_id?: string; // Target warehouse
  status: 'draft' | 'completed' | 'cancelled';
  total_amount: number;
  created_at: string;
  updated_at: string;
}


@Injectable()
export class MockStore {
  public products: Product[] = [];
  public partners: Partner[] = [];
  public priceLists: PriceList[] = [];
  public partnerPriceLists: Record<string, string> = {}; // partner_id -> price_list_id
  public documents: Document[] = [];
  public documentItems: DocumentItem[] = [];
  public productSkuAliases: ProductSkuAlias[] = [];

  // Enterprise additions
  public warehouses: Warehouse[] = [];
  public warehouseStock: WarehouseStock[] = [];
  public agents: Agent[] = [];
  public agentCommissions: AgentCommission[] = [];
  public productSuggestions: ProductSuggestion[] = [];

  constructor() {
    this.seed();
  }


  private seed() {
    // 1. Seed Partners
    const supplierId = '11111111-1111-1111-1111-111111111111';
    const client1Id = '22222222-2222-2222-2222-222222222222';
    const client2Id = '33333333-3333-3333-3333-333333333333';

    this.partners = [
      {
        id: supplierId,
        type: 'supplier',
        name: 'MEREGALLI GIUSEPPE SPA',
        vat_number: '00845920966',
        tax_code: '00845920966',
        sdi_code: '05CYA99',
        email: 'info@meregalli.it',
        address: 'VIA VISCONTI 43, 20900 MONZA (MB)',
        phone: '039-230001',
        created_at: new Date().toISOString(),
      },
      {
        id: client1Id,
        type: 'client',
        name: 'ENOTECA DEL CORSO',
        vat_number: '01234560721',
        tax_code: '01234560721',
        sdi_code: 'M5UXCR1',
        email: 'info@enotecadelcorso.it',
        address: 'VIA ROMA 12, 70121 BARI (BA)',
        phone: '080-5214433',
        created_at: new Date().toISOString(),
        password: 'enoteca123',
      },
      {
        id: client2Id,
        type: 'client',
        name: 'GRAND HOTEL VESUVIO',
        vat_number: '09876543210',
        tax_code: '09876543210',
        sdi_code: 'SUBM930',
        email: 'amministrazione@vesuvio.it',
        address: 'VIA PARTENOPE 45, 80121 NAPOLI (NA)',
        phone: '081-7640044',
        created_at: new Date().toISOString(),
      }
    ];

    // 2. Seed Price Lists
    const listinoHorecaId = '44444444-4444-4444-4444-444444444444';
    const listinoPrivatiId = '55555555-5555-5555-5555-555555555555';
    this.priceLists = [
      {
        id: listinoHorecaId,
        name: 'Listino HORECA',
        markup_percent: 25.00,
        created_at: new Date().toISOString(),
      },
      {
        id: listinoPrivatiId,
        name: 'Listino Privati',
        markup_percent: 50.00,
        created_at: new Date().toISOString(),
      }
    ];

    // Associate HORECA list to Enoteca del Corso
    this.partnerPriceLists[client1Id] = listinoHorecaId;
    this.partnerPriceLists[client2Id] = listinoHorecaId;

    // 3. Seed Products
    const prodId1 = 'a1111111-1111-1111-1111-111111111111';
    const prodId2 = 'a2222222-2222-2222-2222-222222222222';
    const prodId3 = 'a3333333-3333-3333-3333-333333333333';

    this.products = [
      {
        id: prodId1,
        sku: '6441MA',
        name: "CUVEE PREMIERE CHASSENAY D'ARCE VINO CHAMP.LT.0,75 GR.12",
        vintage: 'NV',
        format: '0.75L',
        base_cost: 25.50,
        discounted_cost: 24.74, // Costo post-sconto del 3% (25.50 * 0.97)
        markup_percent: 30.00,
        vat_percent: 22.00,
        is_manual_price: false,
        manual_price: null,
        stock_quantity: 36,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: prodId2,
        sku: '7229AM',
        name: 'AMARONE DELLA VALPOLICELLA CLASSICO LT.0,75 GR.16',
        vintage: '2019',
        format: '0.75L',
        base_cost: 38.00,
        discounted_cost: null,
        markup_percent: 45.00,
        vat_percent: 22.00,
        is_manual_price: false,
        manual_price: null,
        stock_quantity: 12,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: prodId3,
        sku: '8114ME',
        name: 'BRUNELLO DI MONTALCINO MAGNUM LT.1,5 GR.14.5',
        vintage: '2018',
        format: '1.5L',
        base_cost: 75.00,
        discounted_cost: null,
        markup_percent: 35.00,
        vat_percent: 22.00,
        is_manual_price: true,
        manual_price: 110.00,
        stock_quantity: 6,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    ];

    this.recalculateProductPrices();

    // 4. Seed Documents (Fattura Ricevuta da Meregalli)
    const docId = 'd1111111-1111-1111-1111-111111111111';
    this.documents = [
      {
        id: docId,
        type: 'invoice_purchase',
        number: '10092/FE',
        date: '2026-05-20',
        partner_id: supplierId,
        status: 'completed',
        total_amount: 905.30,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
    ];

    // Seed Document Items (Row 4 & 5 of invoice)
    this.documentItems = [
      {
        id: 'di111111-1111-1111-1111-111111111111',
        document_id: docId,
        product_id: prodId1,
        quantity: 30,
        unit_price: 25.50,
        discount_percent: 3.00,
        vat_percent: 22.00,
        lot_number: 'L052026',
        expiry_date: undefined,
        created_at: new Date().toISOString(),
      },
      {
        id: 'di222222-2222-2222-2222-222222222222',
        document_id: docId,
        product_id: prodId1,
        quantity: 6,
        unit_price: 25.50,
        discount_percent: 100.00, // Merce ceduta a titolo di sconto (omaggio)
        vat_percent: 22.00,
        lot_number: 'L052026',
        expiry_date: undefined,
        created_at: new Date().toISOString(),
      }
    ];

    // 5. Seed Warehouses
    const wh1Id = 'w1111111-1111-1111-1111-111111111111';
    const wh2Id = 'w2222222-2222-2222-2222-222222222222';
    this.warehouses = [
      {
        id: wh1Id,
        code: 'DEP-PRINCIPALE',
        name: 'Deposito Principale Cantina',
        location: 'Via della Cantina 1, Valpolicella',
        created_at: new Date().toISOString()
      },
      {
        id: wh2Id,
        code: 'DEP-ESTERNO',
        name: 'Deposito Logistico Esterno',
        location: 'Interporto Quadrante Europa, Verona',
        created_at: new Date().toISOString()
      }
    ];

    // Seed Warehouse Stock
    this.products.forEach(p => {
      this.warehouseStock.push({
        product_id: p.id,
        warehouse_id: wh1Id,
        stock_quantity: p.stock_quantity,
        updated_at: new Date().toISOString()
      });
    });

    // 6. Seed Agents
    const agent1Id = 'ag111111-1111-1111-1111-111111111111';
    const agent2Id = 'ag222222-2222-2222-2222-222222222222';
    this.agents = [
      {
        id: agent1Id,
        name: 'Mario Rossi',
        email: 'mario.rossi@cantinaprivilege.it',
        phone: '333-1234567',
        vat_number: 'IT01234567890',
        default_commission_percent: 10.00,
        created_at: new Date().toISOString(),
        password: 'rossi123'
      },
      {
        id: agent2Id,
        name: 'Luigi Bianchi',
        email: 'luigi.bianchi@cantinaprivilege.it',
        phone: '333-7654321',
        vat_number: 'IT09876543210',
        default_commission_percent: 8.50,
        created_at: new Date().toISOString(),
        password: 'bianchi123'
      }
    ];

    // Associate agents to seeded partners
    const client1 = this.partners.find(p => p.id === '22222222-2222-2222-2222-222222222222');
    if (client1) client1.agent_id = agent1Id;

    const client2 = this.partners.find(p => p.id === '33333333-3333-3333-3333-333333333333');
    if (client2) client2.agent_id = agent2Id;

    // Seed document warehouse association
    this.documents.forEach(d => {
      d.warehouse_id = wh1Id;
    });

    // Seed Agent Commissions
    this.agentCommissions = [
      {
        id: 'c1111111-1111-1111-1111-111111111111',
        agent_id: agent1Id,
        document_id: docId,
        amount: 90.53, // 10% of 905.30
        commission_percent: 10.00,
        status: 'unpaid',
        calculated_at: new Date().toISOString()
      }
    ];
  }

  public recalculateProductPrices() {
    this.products.forEach(p => {
      if (p.is_manual_price) {
        p.selling_price_net = Number((p.manual_price || 0).toFixed(2));
      } else {
        const cost = p.discounted_cost !== null && p.discounted_cost !== undefined ? p.discounted_cost : p.base_cost;
        p.selling_price_net = Number((cost * (1 + p.markup_percent / 100)).toFixed(2));
      }
      p.selling_price_gross = Number((p.selling_price_net * (1 + p.vat_percent / 100)).toFixed(2));
    });
  }

  public applyStockMovement(doc: Document, items: DocumentItem[], multiplier: number) {
    if (!['ddt_in', 'stock_load', 'invoice_purchase', 'ddt_out', 'invoice_sale'].includes(doc.type)) {
      return;
    }

    let direction = 1;
    if (['ddt_out', 'invoice_sale'].includes(doc.type)) {
      direction = -1;
    }

    const netMultiplier = direction * multiplier;

    items.forEach(item => {
      const prod = this.products.find(p => p.id === item.product_id);
      if (prod) {
        prod.stock_quantity += item.quantity * netMultiplier;
        prod.updated_at = new Date().toISOString();
      }
    });
  }
}
