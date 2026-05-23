import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Abilita CORS per collegarsi con il frontend React
  app.enableCors({
    origin: '*', // Consentiamo tutte le origini per sviluppo locale
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  // Aumenta il limite del body per caricare file XML più grandi
  app.use(json({ limit: '10mb' }));

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`[ERP BACKEND] Cantina Privilege in esecuzione su: http://localhost:${port}`);
}
bootstrap();
