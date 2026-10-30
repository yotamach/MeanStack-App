import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/http-exception.filter';
import { Env } from './config/env';
import { StorageService } from './storage/storage.service';

/** Everything main.ts and the e2e tests share, so tests exercise the real app configuration. */
export function configureApp(app: NestExpressApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  app.setGlobalPrefix('api');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({ origin: config.get('CLIENT_ORIGIN', { infer: true }) });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useStaticAssets(app.get(StorageService).dir, { prefix: '/images' });
}
