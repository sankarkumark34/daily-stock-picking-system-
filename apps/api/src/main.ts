import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { loadConfig } from './config/app.config.js';

async function bootstrap() {
  const cfg = loadConfig();
  const app = await NestFactory.create(AppModule, { logger: ['log', 'warn', 'error'] });
  app.setGlobalPrefix('api');
  app.enableCors({ origin: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));

  const doc = new DocumentBuilder()
    .setTitle('NSE Picks API')
    .setDescription('Daily quantitative NSE stock-selection system: data ingestion, regime, sector strength, scoring, picks, outcomes and backtests.')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));

  await app.listen(cfg.port);
  new Logger('Bootstrap').log(`API listening on http://localhost:${cfg.port}/api  (docs at /docs, db=${cfg.db.type})`);
}
await bootstrap();
