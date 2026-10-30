import { createTestApp, TestApp } from './helpers';

describe('Auth rate limiting', () => {
  let t: TestApp;
  beforeAll(async () => (t = await createTestApp()));
  afterAll(() => t.close());

  it('answers 429 after 20 auth requests in a minute', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 22; i++) {
      const res = await t.http().post('/api/user/login').send({ email: 'a@b.co', password: 'x' });
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 20).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(20)).toEqual([429, 429]);
  });
});
