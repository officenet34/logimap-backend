import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import * as express from 'express';
import { AppModule } from './app.module';
import { validateEnv } from './config/validate-env';
import { ensureUploadDirs, getUploadsRoot } from './config/uploads.config';
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

  ensureUploadDirs();
  const uploadsRoot = getUploadsRoot();
  app.use('/uploads', express.static(uploadsRoot));
  console.log(`LogiMap uploads: ${uploadsRoot} (UPLOAD_ROOT ile kalıcı volume bağlayın)`);

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
