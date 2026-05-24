-- Supabase Migration: Enterprise Upgrade Schema for Cantina Privilege ERP

-- 1. Modulo Multi-Deposito (Warehouses)
CREATE TABLE IF NOT EXISTS warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabella di raccordo per le giacenze nei vari magazzini
CREATE TABLE IF NOT EXISTS warehouse_stock (
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
  stock_quantity INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (product_id, warehouse_id)
);

-- Inserimento di due magazzini predefiniti
INSERT INTO warehouses (code, name, location) VALUES 
('DEP-PRINCIPALE', 'Deposito Principale Cantina', 'Via della Cantina 1, Valpolicella'),
('DEP-ESTERNO', 'Deposito Logistico Esterno', 'Interporto Quadrante Europa, Verona')
ON CONFLICT (code) DO NOTHING;

-- 2. Modulo Agenti di Vendita e Provvigioni
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  vat_number TEXT,
  default_commission_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Associazione Partner (Clienti) -> Agenti
ALTER TABLE partners ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE SET NULL;

-- Tabella delle provvigioni maturate
CREATE TABLE IF NOT EXISTS agent_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  commission_percent NUMERIC(5,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'cancelled')),
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Estensione Documenti per Multi-Deposito
ALTER TABLE documents ADD COLUMN IF NOT EXISTS warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL;

-- 4. Funzione Trigger Aggiornata per Gestione Stock Multi-Deposito
CREATE OR REPLACE FUNCTION process_enterprise_document_stock_transition()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  qty_multiplier INT;
  target_warehouse_id UUID;
BEGIN
  -- Se non è specificato un magazzino per il documento, usa quello di default
  IF NEW.warehouse_id IS NULL THEN
    SELECT id INTO target_warehouse_id FROM warehouses WHERE code = 'DEP-PRINCIPALE';
  ELSE
    target_warehouse_id := NEW.warehouse_id;
  END IF;

  -- Se lo stato non è cambiato in/da 'completed', non fare nulla
  IF (TG_OP = 'UPDATE' AND OLD.status = NEW.status) THEN
    RETURN NEW;
  END IF;

  -- 1. Transizione a COMPLETED (Stock si incrementa o decrementa nel magazzino target)
  IF (NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status != 'completed')) THEN
    IF NEW.type IN ('ddt_in', 'stock_load', 'invoice_purchase') THEN
      qty_multiplier := 1;
    ELSIF NEW.type IN ('ddt_out', 'invoice_sale') THEN
      qty_multiplier := -1;
    ELSE
      qty_multiplier := 0;
    END IF;

    IF qty_multiplier != 0 THEN
      FOR item IN SELECT product_id, quantity FROM document_items WHERE document_id = NEW.id LOOP
        -- Upsert giacenza per la combinazione prodotto/magazzino
        INSERT INTO warehouse_stock (product_id, warehouse_id, stock_quantity)
        VALUES (item.product_id, target_warehouse_id, item.quantity * qty_multiplier)
        ON CONFLICT (product_id, warehouse_id)
        DO UPDATE SET stock_quantity = warehouse_stock.stock_quantity + (item.quantity * qty_multiplier),
                      updated_at = timezone('utc'::text, now());
                      
        -- Aggiorna lo stock totale consolidato sulla tabella products per retrocompatibilità
        UPDATE products 
        SET stock_quantity = stock_quantity + (item.quantity * qty_multiplier)
        WHERE id = item.product_id;
      END LOOP;
    END IF;
  END IF;

  -- 2. Transizione da COMPLETED a DRAFT/CANCELLED (Inversione dello stock)
  IF (TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status != 'completed') THEN
    IF NEW.type IN ('ddt_in', 'stock_load', 'invoice_purchase') THEN
      qty_multiplier := -1;
    ELSIF NEW.type IN ('ddt_out', 'invoice_sale') THEN
      qty_multiplier := 1;
    ELSE
      qty_multiplier := 0;
    END IF;

    IF qty_multiplier != 0 THEN
      FOR item IN SELECT product_id, quantity FROM document_items WHERE document_id = NEW.id LOOP
        UPDATE warehouse_stock
        SET stock_quantity = stock_quantity + (item.quantity * qty_multiplier),
            updated_at = timezone('utc'::text, now())
        WHERE product_id = item.product_id AND warehouse_id = target_warehouse_id;

        UPDATE products 
        SET stock_quantity = stock_quantity + (item.quantity * qty_multiplier)
        WHERE id = item.product_id;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Riaplicazione del trigger per la gestione del magazzino enterprise
DROP TRIGGER IF EXISTS trg_document_stock_transition ON documents;
CREATE TRIGGER trg_document_stock_transition
AFTER INSERT OR UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION process_enterprise_document_stock_transition();
