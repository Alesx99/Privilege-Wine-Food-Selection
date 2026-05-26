-- Supabase Migration: Transactional Merge & SKU Aliasing for Cantina Privilege ERP

-- 1. Tabella degli Alias SKU per supportare lo storico SKU e reindirizzamenti e-commerce
CREATE TABLE IF NOT EXISTS product_sku_aliases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indice per ricerche veloci degli alias SKU
CREATE INDEX IF NOT EXISTS idx_product_sku_aliases_sku ON product_sku_aliases(sku);

-- 2. Funzione transazionale (RPC) per eseguire il merge atomico di due prodotti
CREATE OR REPLACE FUNCTION merge_products(target_id UUID, source_id UUID)
RETURNS VOID AS $$
DECLARE
  completed_doc_ids UUID[];
  source_stock RECORD;
  target_stock RECORD;
  new_qty INT;
  new_total_stock INT;
  initial_target_stock INT;
  initial_source_stock INT;
BEGIN
  -- Validazione preliminare
  IF target_id = source_id THEN
    RAISE EXCEPTION 'Impossibile unire un prodotto con se stesso.';
  END IF;

  -- Acquisizione degli stock iniziali per il ricalcolo consolidato
  SELECT stock_quantity INTO initial_target_stock FROM products WHERE id = target_id;
  SELECT stock_quantity INTO initial_source_stock FROM products WHERE id = source_id;

  IF initial_target_stock IS NULL THEN
    RAISE EXCEPTION 'Prodotto di destinazione non trovato';
  END IF;
  IF initial_source_stock IS NULL THEN
    RAISE EXCEPTION 'Prodotto sorgente non trovato';
  END IF;

  -- Individua i documenti completati legati al prodotto sorgente
  SELECT COALESCE(ARRAY_AGG(DISTINCT d.id), '{}') INTO completed_doc_ids
  FROM documents d
  JOIN document_items di ON di.document_id = d.id
  WHERE di.product_id = source_id AND d.status = 'completed';

  -- 1. Riporta temporaneamente a bozza i documenti completati coinvolti (innesca inversione stock nei trigger)
  IF ARRAY_LENGTH(completed_doc_ids, 1) > 0 THEN
    UPDATE documents 
    SET status = 'draft', updated_at = now() 
    WHERE id = ANY(completed_doc_ids);
  END IF;

  -- 2. Modifica il product_id in tutte le righe di document_items che puntavano al sorgente
  UPDATE document_items 
  SET product_id = target_id 
  WHERE product_id = source_id;

  -- 3. Ripristina i documenti a completato (innesca ricarica stock su target nei trigger)
  IF ARRAY_LENGTH(completed_doc_ids, 1) > 0 THEN
    UPDATE documents 
    SET status = 'completed', updated_at = now() 
    WHERE id = ANY(completed_doc_ids);
  END IF;

  -- 4. Consolida le giacenze multi-deposito (warehouse_stock)
  FOR source_stock IN SELECT * FROM warehouse_stock WHERE product_id = source_id LOOP
    SELECT * INTO target_stock 
    FROM warehouse_stock 
    WHERE product_id = target_id AND warehouse_id = source_stock.warehouse_id;

    IF FOUND THEN
      -- Se il deposito esiste già nel target, sommiamo e cancelliamo il sorgente
      new_qty := COALESCE(target_stock.stock_quantity, 0) + COALESCE(source_stock.stock_quantity, 0);
      
      UPDATE warehouse_stock 
      SET stock_quantity = new_qty, updated_at = now()
      WHERE product_id = target_id AND warehouse_id = source_stock.warehouse_id;

      DELETE FROM warehouse_stock 
      WHERE product_id = source_id AND warehouse_id = source_stock.warehouse_id;
    ELSE
      -- Se il deposito non esiste nel target, riassegniamo la riga
      UPDATE warehouse_stock 
      SET product_id = target_id, updated_at = now()
      WHERE product_id = source_id AND warehouse_id = source_stock.warehouse_id;
    END IF;
  END FOR;

  -- 5. Ricalcolo finale dello stock totale su products per coerenza
  new_total_stock := COALESCE(initial_target_stock, 0) + COALESCE(initial_source_stock, 0);
  UPDATE products 
  SET stock_quantity = new_total_stock, updated_at = now() 
  WHERE id = target_id;

  -- 6. Gestione SKU Alias per reindirizzamenti e-commerce
  INSERT INTO product_sku_aliases (product_id, sku)
  SELECT target_id, sku FROM products WHERE id = source_id
  ON CONFLICT (sku) DO NOTHING;
  
  -- Sposta eventuali alias preesistenti associati al sorgente verso il target
  UPDATE product_sku_aliases 
  SET product_id = target_id 
  WHERE product_id = source_id;

  -- 7. Elimina fisicamente il prodotto sorgente dal catalogo
  DELETE FROM products WHERE id = source_id;

END;
$$ LANGUAGE plpgsql;
