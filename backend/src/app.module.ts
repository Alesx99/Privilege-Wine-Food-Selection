import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseService } from './supabase.service';
import { MockStore } from './mock-store';
import { SianService } from './sian.service';
import { AcciseService } from './accise.service';
import { ReconciliationService } from './reconciliation.service';
import { EcommerceController } from './ecommerce.controller';

@Module({
  imports: [],
  controllers: [AppController, EcommerceController],
  providers: [
    AppService, 
    SupabaseService, 
    MockStore, 
    SianService, 
    AcciseService, 
    ReconciliationService
  ],
})
export class AppModule {}

