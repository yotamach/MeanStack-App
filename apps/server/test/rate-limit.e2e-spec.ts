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

describe('Refresh rate limiting', () => {
  let t: TestApp;
  beforeAll(async () => (t = await createTestApp()));
  afterAll(() => t.close());

  it('allows 60 refreshes a minute, separately from the login limit', async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 62; i++) {
      statuses.push((await t.http().post('/api/user/refresh')).status);
    }
    expect(statuses.slice(0, 60).every((s) => s === 401)).toBe(true);
    expect(statuses.slice(60)).toEqual([429, 429]);
    // the login counter is untouched by refresh traffic
    await t.http().post('/api/user/login').send({ email: 'a@b.co', password: 'x' }).expect(401);
  });
});
