import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

/** A valid 1x1 PNG. */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export interface TestApp {
  app: NestExpressApplication;
  http: () => ReturnType<typeof request>;
  close: () => Promise<void>;
}

export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return {
    app,
    http: () => request(app.getHttpServer()),
    close: async () => {
      await app.get<Connection>(getConnectionToken()).dropDatabase();
      await app.close();
    },
  };
}

let counter = 0;
export const uniqueEmail = () => `user${Date.now()}_${counter++}@test.dev`;

export async function registerAndLogin(t: TestApp, password = 'pw123456') {
  const email = uniqueEmail();
  await t.http().post('/api/user/signup').send({ email, password }).expect(201);
  const res = await t.http().post('/api/user/login').send({ email, password }).expect(200);
  return { email, password, token: res.body.token as string, userId: res.body.userId as string };
}
