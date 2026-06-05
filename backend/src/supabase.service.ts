import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private readonly logger = new Logger(SupabaseService.name);
  private client: SupabaseClient | null = null;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY || process.env.SUPABASE_ANON_KEY;

    if (url && key) {
      try {
        this.client = createClient(url, key, {
          auth: {
            persistSession: false,
          },
        });
        this.logger.log('Supabase client initialized successfully.');
      } catch (err) {
        this.logger.error('Failed to initialize Supabase client:', err);
      }
    } else {
      this.logger.warn(
        'Supabase credentials missing. Running in local fallback mode (mock memory database). Please set SUPABASE_URL and SUPABASE_KEY in .env.',
      );
    }
  }

  async onModuleInit() {
    if (this.client) {
      try {
        // Query di test per verificare la connessione e la presenza delle tabelle
        const { error } = await this.client.from('products').select('id').limit(1);
        if (error) {
          this.logger.error(
            `⚠️ SUPABASE CONNECTION ERROR: Query fallita sulla tabella 'products'. Dettagli: ${error.message} (Codice: ${error.code})`
          );
          if (error.code === '42P01') {
            this.logger.error(
              `👉 SUGGERIMENTO: La tabella 'products' non esiste. Assicurati di aver eseguito le migrazioni SQL contenute nella cartella 'supabase/migrations/' sul pannello SQL Editor di Supabase.`
            );
          } else {
            this.logger.error(
              `👉 SUGGERIMENTO: Verifica che il tuo progetto Supabase non sia in pausa e che le chiavi SUPABASE_URL e SUPABASE_KEY siano corrette.`
            );
          }
        } else {
          this.logger.log('✨ Connessione a Supabase verificata con successo (le tabelle esistono).');
        }
      } catch (err) {
        this.logger.error('Errore imprevisto durante il ping di test di Supabase:', err);
      }
    }
  }

  getClient(): SupabaseClient {
    if (!this.client) {
      throw new Error(
        'Supabase client is not initialized. Check your environment variables (SUPABASE_URL and SUPABASE_KEY).',
      );
    }
    return this.client;
  }

  isInitialized(): boolean {
    return this.client !== null;
  }
}

