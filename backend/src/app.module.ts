import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { SupabaseService } from './supabase.service';
import { MockStore } from './mock-store';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService, SupabaseService, MockStore],
})
export class AppModule {}
