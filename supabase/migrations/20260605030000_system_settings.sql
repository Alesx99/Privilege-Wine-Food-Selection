-- Creazione tabella per le impostazioni globali di sistema
CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Disabilita RLS per consentire letture/scritture globali
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

-- Inserimento del flag predefinito per nascondere i prezzi
INSERT INTO system_settings (key, value) VALUES ('hide_prices_globally', 'false') ON CONFLICT (key) DO NOTHING;
