import { Injectable, Logger } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
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
