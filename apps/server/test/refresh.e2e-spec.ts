import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RefreshToken, RefreshTokenDocument } from '../src/auth/refresh-token.schema';
import { REUSE_GRACE_MS } from '../src/auth/refresh-token.service';
import { User, UserDocument } from '../src/auth/user.schema';
import { createTestApp, TestApp, uniqueEmail } from './helpers';

const COOKIE = 'refresh_token';

const setCookies = (res: { headers: Record<string, unknown> }): string[] =>
  (res.headers['set-cookie'] as string[] | undefined) ?? [];
const refreshCookie = (res: { headers: Record<string, unknown> }) =>
  setCookies(res).find((c) => c.startsWith(`${COOKIE}=`));
const cookieValue = (res: { headers: Record<string, unknown> }) =>
  refreshCookie(res)
    ?.split(';')[0]
    .slice(COOKIE.length + 1) as string;
const decodeJwt = (token: string) =>
  JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

describe('Refresh tokens', () => {
  let t: TestApp;
  let tokens: Model<RefreshTokenDocument>;
  let users: Model<UserDocument>;
  const password = 'pw123456';

  beforeAll(async () => {
    t = await createTestApp();
    tokens = t.app.get(getModelToken(RefreshToken.name));
    users = t.app.get(getModelToken(User.name));
  });
  afterAll(() => t.close());

  /** A fresh user logged in once: returns the login response and the first refresh cookie value. */
  const login = async () => {
    const email = uniqueEmail();
    await t.http().post('/api/user/signup').send({ email, password }).expect(201);
    const res = await t.http().post('/api/user/login').send({ email, password }).expect(200);
    return { email, res, token: res.body.token as string, cookie: cookieValue(res) };
  };
  const refresh = (cookie?: string) => {
    const req = t.http().post('/api/user/refresh');
    return cookie === undefined ? req : req.set('Cookie', `${COOKIE}=${cookie}`);
  };
  /** True when the access token gets past the auth guard (the post id does not exist, so 401 "Not authorized!"). */
  const accepted = async (token: string) => {
    const res = await t
      .http()
      .delete('/api/posts/aaaaaaaaaaaaaaaaaaaaaaaa')
      .set('Authorization', `Bearer ${token}`);
    return res.body.message === 'Not authorized!';
  };

  describe('login cookie', () => {
    it('is httpOnly, SameSite=Strict, scoped to the auth endpoints and expires in about a week', async () => {
      const { res } = await login();
      const cookie = refreshCookie(res) as string;
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/SameSite=Strict/i);
      expect(cookie).toMatch(/Path=\/api\/user(;|$)/);
      expect(cookie).not.toMatch(/Secure/i); // plain http
      const expires = new Date(/Expires=([^;]+)/i.exec(cookie)![1]).getTime();
      expect(expires - Date.now()).toBeGreaterThan(6.9 * 24 * 3600_000);
      expect(expires - Date.now()).toBeLessThan(7.1 * 24 * 3600_000);
    });

    it('is Secure when the request came in over https behind a proxy', async () => {
      const email = uniqueEmail();
      await t.http().post('/api/user/signup').send({ email, password }).expect(201);
      const res = await t
        .http()
        .post('/api/user/login')
        .set('X-Forwarded-Proto', 'https')
        .send({ email, password })
        .expect(200);
      expect(refreshCookie(res)).toMatch(/Secure/i);
    });

    it('never puts the refresh token in the response body, and the access token lives 15 minutes', async () => {
      const { res, cookie } = await login();
      expect(JSON.stringify(res.body)).not.toContain(cookie);
      const payload = decodeJwt(res.body.token);
      expect(payload.exp - payload.iat).toBe(900);
      expect(res.body.expiresIn).toBe(900);
    });

    it('is stored only as a hash', async () => {
      const { cookie } = await login();
      expect(await tokens.findOne({ tokenHash: cookie })).toBeNull();
      expect(await tokens.countDocuments({})).toBeGreaterThan(0);
    });

    it('is not issued for a failed login', async () => {
      const { email } = await login();
      const res = await t
        .http()
        .post('/api/user/login')
        .send({ email, password: 'wrong' })
        .expect(401);
      expect(refreshCookie(res)).toBeUndefined();
    });
  });

  describe('POST /api/user/refresh', () => {
    it('returns a working access token for the same user and rotates the cookie', async () => {
      const first = await login();
      const res = await refresh(first.cookie).expect(200);
      expect(res.body).toEqual({
        token: expect.any(String),
        expiresIn: 900,
        userId: first.res.body.userId,
      });
      expect(await accepted(res.body.token)).toBe(true);
      expect(cookieValue(res)).toBeTruthy();
      expect(cookieValue(res)).not.toBe(first.cookie);
      // and the new cookie keeps working
      await refresh(cookieValue(res)).expect(200);
    });

    it.each([
      ['no cookie', undefined],
      ['a made-up cookie', 'not-a-real-token'],
    ])('rejects %s', async (_name, cookie) => {
      const res = await refresh(cookie).expect(401);
      expect(res.body).toEqual({ message: 'Session expired!' });
      expect(refreshCookie(res)).toBeUndefined();
    });

    it('rejects an expired token', async () => {
      const { cookie } = await login();
      await tokens.updateMany({}, { expiresAt: new Date(Date.now() - 1000) });
      await refresh(cookie).expect(401);
    });

    it('tolerates the same token twice within the grace window (two tabs refreshing together)', async () => {
      const { cookie } = await login();
      await refresh(cookie).expect(200);
      await refresh(cookie).expect(200);
    });

    it('treats reuse after the grace window as theft and ends the whole session', async () => {
      const { cookie } = await login();
      const rotated = await refresh(cookie).expect(200);
      const newest = cookieValue(rotated);
      await tokens.updateMany(
        { replacedAt: { $exists: true } },
        { replacedAt: new Date(Date.now() - REUSE_GRACE_MS - 5000) },
      );

      await refresh(cookie).expect(401); // the leaked, already-used token
      await refresh(newest).expect(401); // the legitimate holder is signed out too
    });

    it('rejects a token whose user no longer exists', async () => {
      const { email, cookie } = await login();
      await users.deleteOne({ email });
      await refresh(cookie).expect(401);
    });
  });

  describe('POST /api/user/logout', () => {
    it('clears the cookie and revokes the refresh token', async () => {
      const { cookie } = await login();
      const res = await t
        .http()
        .post('/api/user/logout')
        .set('Cookie', `${COOKIE}=${cookie}`)
        .expect(200);
      expect(refreshCookie(res)).toMatch(/refresh_token=;.*Expires=Thu, 01 Jan 1970/i);
      await refresh(cookie).expect(401);
    });

    it('revokes tokens already rotated within the same session', async () => {
      const { cookie } = await login();
      const rotated = cookieValue(await refresh(cookie).expect(200));
      await t.http().post('/api/user/logout').set('Cookie', `${COOKIE}=${rotated}`).expect(200);
      await refresh(rotated).expect(401);
      await refresh(cookie).expect(401);
    });

    it('succeeds without a cookie', async () => {
      await t.http().post('/api/user/logout').expect(200);
    });

    it('leaves a different session of the same user alone', async () => {
      const email = uniqueEmail();
      await t.http().post('/api/user/signup').send({ email, password }).expect(201);
      const a = cookieValue(
        await t.http().post('/api/user/login').send({ email, password }).expect(200),
      );
      const b = cookieValue(
        await t.http().post('/api/user/login').send({ email, password }).expect(200),
      );
      await t.http().post('/api/user/logout').set('Cookie', `${COOKIE}=${a}`).expect(200);
      await refresh(a).expect(401);
      await refresh(b).expect(200);
    });
  });
});
