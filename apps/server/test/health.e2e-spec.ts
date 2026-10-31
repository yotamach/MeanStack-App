import { createTestApp, TestApp } from './helpers';

describe('Health API', () => {
  let t: TestApp;
  beforeAll(async () => (t = await createTestApp()));
  afterAll(() => t.close());

  it('reports ok while the database is connected', async () => {
    const res = await t.http().get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', db: 'up' });
  });
});
