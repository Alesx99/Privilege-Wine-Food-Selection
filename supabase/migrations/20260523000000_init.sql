-- Supabase Migration: Init Schema for Cantina Privilege ERP

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Tabella Prodotti
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  vintage TEXT NOT NULL DEFAULT 'NV',
  format TEXT NOT NULL DEFAULT '0.75L',
  base_cost NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  discounted_cost NUMERIC(10,2) DEFAULT NULL, -- Costo scontato per bottiglia (es. per acquisti in quantità)
  markup_percent NUMERIC(5,2) NOT NULL DEFAULT 30.00,
  vat_percent NUMERIC(5,2) NOT NULL DEFAULT 22.00,
  is_manual_price BOOLEAN NOT NULL DEFAULT false,
  manual_price NUMERIC(10,2) DEFAULT NULL,
  stock_quantity INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Prezzo netto calcolato o manuale (Stored Generated Column)
ALTER TABLE products ADD COLUMN selling_price_net NUMERIC(10,2) GENERATED ALWAYS AS (
  CASE 
    WHEN is_manual_price THEN COALESCE(manual_price, 0.00)
    ELSE ROUND(COALESCE(discounted_cost, base_cost) * (1 + markup_percent / 100), 2)
  END
) STORED;

-- Prezzo lordo (con IVA)
ALTER TABLE products ADD COLUMN selling_price_gross NUMERIC(10,2) GENERATED ALWAYS AS (
  CASE 
    WHEN is_manual_price THEN ROUND(COALESCE(manual_price, 0.00) * (1 + vat_percent / 100), 2)
    ELSE ROUND(COALESCE(discounted_cost, base_cost) * (1 + markup_percent / 100) * (1 + vat_percent / 100), 2)
  END
) STORED;

-- 2. Tabella Partner (Anagrafiche Clienti/Fornitori)
CREATE TABLE partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('client', 'supplier', 'both')),
  name TEXT NOT NULL,
  vat_number TEXT NOT NULL, -- Partita IVA
  tax_code TEXT, -- Codice Fiscale
  sdi_code TEXT NOT NULL DEFAULT '0000000', -- Codice SDI
  email TEXT,
  address TEXT,
  phone TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabella Listini (Price Lists)
CREATE TABLE price_lists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, -- e.g., 'Horeca', 'Privati', 'Estero'
  markup_percent NUMERIC(5,2) NOT NULL, -- Ricarico di default di questo listini
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Associazione Partner -> Listino
CREATE TABLE partner_price_lists (
  partner_id UUID PRIMARY KEY REFERENCES partners(id) ON DELETE CASCADE,
  price_list_id UUID REFERENCES price_lists(id) ON DELETE SET NULL
);

-- 4. Tabella Documenti (Ordini, DDT, Carichi, Fatture)
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('order_supplier', 'ddt_in', 'ddt_out', 'stock_load', 'invoice_sale', 'invoice_purchase')),
  number TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'completed', 'cancelled')),
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Dettagli Righe Documento (document_items)
CREATE TABLE document_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10,2) NOT NULL,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
  vat_percent NUMERIC(5,2) NOT NULL DEFAULT 22.00,
  lot_number TEXT,
  expiry_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- INDICI per prestazioni ottimali
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_partners_vat ON partners(vat_number);
CREATE INDEX idx_documents_partner ON documents(partner_id);
CREATE INDEX idx_document_items_doc ON document_items(document_id);
CREATE INDEX idx_document_items_prod ON document_items(product_id);

-- TRIGGER 1: Blocca modifiche a righe di documenti già completati
CREATE OR REPLACE FUNCTION check_document_items_lock()
RETURNS TRIGGER AS $$
DECLARE
  doc_status TEXT;
  doc_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    doc_id := OLD.document_id;
  ELSE
    doc_id := NEW.document_id;
  END IF;

  SELECT status INTO doc_status FROM documents WHERE id = doc_id;
  IF doc_status = 'completed' THEN
    RAISE EXCEPTION 'Non puoi modificare o cancellare righe di un documento completato. Riporta lo stato del documento a Bozza (draft) prima di procedere.';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_document_items_lock
BEFORE INSERT OR UPDATE OR DELETE ON document_items
FOR EACH ROW EXECUTE FUNCTION check_document_items_lock();


-- TRIGGER 2: Gestione automatica dello Stock Magazzino in base ai Documenti completati
CREATE OR REPLACE FUNCTION process_document_stock_transition()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  qty_multiplier INT;
BEGIN
  -- Se lo stato non è cambiato in/da 'completed', non fare nulla
  IF (TG_OP = 'UPDATE' AND OLD.status = NEW.status) THEN
    RETURN NEW;
  END IF;

  -- 1. Transizione a COMPLETED (Stock si aggiorna)
  IF (NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status != 'completed')) THEN
    -- Carichi (incrementano il magazzino)
    IF NEW.type IN ('ddt_in', 'stock_load', 'invoice_purchase') THEN
      qty_multiplier := 1;
    -- Scarichi (decrementano il magazzino)
    ELSIF NEW.type IN ('ddt_out', 'invoice_sale') THEN
      qty_multiplier := -1;
    ELSE
      qty_multiplier := 0;
    END IF;

    IF qty_multiplier != 0 THEN
      FOR item IN SELECT product_id, quantity FROM document_items WHERE document_id = NEW.id LOOP
        UPDATE products 
        SET stock_quantity = stock_quantity + (item.quantity * qty_multiplier)
        WHERE id = item.product_id;
      END LOOP;
    END IF;
  END IF;

  -- 2. Transizione da COMPLETED a DRAFT/CANCELLED (Stock si inverte)
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
        UPDATE products 
        SET stock_quantity = stock_quantity + (item.quantity * qty_multiplier)
        WHERE id = item.product_id;
      END LOOP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_document_stock_transition
AFTER INSERT OR UPDATE ON documents
FOR EACH ROW EXECUTE FUNCTION process_document_stock_transition();


-- TRIGGER 3: Gestione della cancellazione di un documento completato
CREATE OR REPLACE FUNCTION process_document_delete()
RETURNS TRIGGER AS $$
DECLARE
  item RECORD;
  qty_multiplier INT;
BEGIN
  IF OLD.status = 'completed' THEN
    IF OLD.type IN ('ddt_in', 'stock_load', 'invoice_purchase') THEN
      qty_multiplier := -1;
    ELSIF OLD.type IN ('ddt_out', 'invoice_sale') THEN
      qty_multiplier := 1;
    ELSE
      qty_multiplier := 0;
    END IF;

    IF qty_multiplier != 0 THEN
      FOR item IN SELECT product_id, quantity FROM document_items WHERE document_id = OLD.id LOOP
        UPDATE products 
        SET stock_quantity = stock_quantity + (item.quantity * qty_multiplier)
        WHERE id = item.product_id;
      END LOOP;
    END IF;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_document_delete
BEFORE DELETE ON documents
FOR EACH ROW EXECUTE FUNCTION process_document_delete();


-- FUNZIONE HELPER: Ottiene il prezzo personalizzato del prodotto in base al partner (e all'eventuale listino associato)
CREATE OR REPLACE FUNCTION get_partner_product_price(p_partner_id UUID, p_product_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_base_cost NUMERIC;
  v_is_manual_price BOOLEAN;
  v_manual_price NUMERIC;
  v_prod_markup NUMERIC;
  v_listino_markup NUMERIC;
  v_final_price NUMERIC;
BEGIN
  -- Recupera le proprietà del prodotto
  SELECT base_cost, is_manual_price, manual_price, markup_percent
  INTO v_base_cost, v_is_manual_price, v_manual_price, v_prod_markup
  FROM products
  WHERE id = p_product_id;

  -- Se il prezzo è gestito manualmente, prevale su qualsiasi listino
  IF v_is_manual_price THEN
    RETURN COALESCE(v_manual_price, 0.00);
  END IF;

  -- Controlla se il partner ha un listino personalizzato associato
  SELECT pl.markup_percent
  INTO v_listino_markup
  FROM partner_price_lists ppl
  JOIN price_lists pl ON ppl.price_list_id = pl.id
  WHERE ppl.partner_id = p_partner_id;

  -- Se il partner ha un ricarico personalizzato usa quello, altrimenti usa il ricarico di default del prodotto
  IF v_listino_markup IS NOT NULL THEN
    v_final_price := ROUND(v_base_cost * (1 + v_listino_markup / 100), 2);
  ELSE
    v_final_price := ROUND(v_base_cost * (1 + v_prod_markup / 100), 2);
  END IF;

  RETURN v_final_price;
END;
$$ LANGUAGE plpgsql;

