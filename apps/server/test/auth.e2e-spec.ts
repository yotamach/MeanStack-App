import { createTestApp, TestApp, uniqueEmail } from './helpers';

describe('Auth API', () => {
  let t: TestApp;
  beforeAll(async () => (t = await createTestApp()));
  afterAll(() => t.close());

  describe('POST /api/user/signup', () => {
    it('creates a user and never returns the password hash', async () => {
      const email = uniqueEmail();
      const res = await t
        .http()
        .post('/api/user/signup')
        .send({ email, password: 'pw123456' })
        .expect(201);
      expect(res.body.result).toEqual({ id: expect.any(String), email });
      expect(JSON.stringify(res.body)).not.toMatch(/\$2[aby]\$/);
    });

    it('rejects a duplicate email', async () => {
      const email = uniqueEmail();
      await t.http().post('/api/user/signup').send({ email, password: 'pw123456' }).expect(201);
      const res = await t
        .http()
        .post('/api/user/signup')
        .send({ email, password: 'other' })
        .expect(400);
      expect(res.body.message).toBe('Invalid or already used email!');
    });

    it.each([
      ['an invalid email', { email: 'nope', password: 'pw123456' }],
      ['a missing password', { email: 'a@b.co' }],
      ['an empty body', {}],
    ])('rejects %s', async (_name, body) => {
      const res = await t.http().post('/api/user/signup').send(body).expect(400);
      expect(typeof res.body.message).toBe('string');
    });
  });

  describe('POST /api/user/login', () => {
    const email = uniqueEmail();
    const password = 'pw123456';
    beforeAll(async () => {
      await t.http().post('/api/user/signup').send({ email, password }).expect(201);
    });

    it('returns a token for the right password', async () => {
      const res = await t.http().post('/api/user/login').send({ email, password }).expect(200);
      expect(res.body).toEqual({
        token: expect.any(String),
        expiresIn: 3600,
        userId: expect.any(String),
      });
    });

    it('rejects a wrong password (regression: login used to ignore the password)', async () => {
      const res = await t
        .http()
        .post('/api/user/login')
        .send({ email, password: 'wrong' })
        .expect(401);
      expect(res.body).toEqual({ message: 'Auth failed!' });
    });

    it('rejects the email used as the password (regression)', async () => {
      await t.http().post('/api/user/login').send({ email, password: email }).expect(401);
    });

    it('gives an unknown user the same answer as a wrong password', async () => {
      const res = await t
        .http()
        .post('/api/user/login')
        .send({ email: uniqueEmail(), password })
        .expect(401);
      expect(res.body).toEqual({ message: 'Auth failed!' });
    });

    it('rejects a missing password without crashing', async () => {
      await t.http().post('/api/user/login').send({ email }).expect(400);
    });
  });

  it('sends restrictive CORS and security headers', async () => {
    const res = await t.http().get('/api/posts').set('Origin', 'http://evil.example').expect(200);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:4200');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});
