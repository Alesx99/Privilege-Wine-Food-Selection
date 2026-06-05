-- Aggiunta colonna password alla tabella dei partner per consentire il login dinamico
ALTER TABLE partners ADD COLUMN IF NOT EXISTS password TEXT DEFAULT NULL;
