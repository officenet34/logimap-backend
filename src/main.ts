import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import * as express from 'express';
import { AppModule } from './app.module';
import { validateEnv } from './config/validate-env';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  validateEnv();

  const app = await NestFactory.create(AppModule);

  const corsRaw = process.env.CORS_ORIGINS ?? '*';
  const origin =
    corsRaw === '*'
      ? true
      : corsRaw.split(',').map((s) => s.trim());

  app.enableCors({ origin, credentials: true });

  const uploadsRoot = join(process.cwd(), 'uploads');
  if (!existsSync(uploadsRoot)) {
    mkdirSync(uploadsRoot, { recursive: true });
  }
  app.use('/uploads', express.static(uploadsRoot));

  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.setGlobalPrefix('v1');

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`LogiMap API http://0.0.0.0:${port}/v1/health`);
}

bootstrap();
