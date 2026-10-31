import { APIRequestContext, Page } from '@playwright/test';

/** A valid 1x1 PNG. */
export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export const NOT_AN_IMAGE = {
  name: 'fake.png',
  mimeType: 'image/png',
  buffer: Buffer.from('definitely not a png'),
};
export const PNG_FILE = { name: 'pic.png', mimeType: 'image/png', buffer: PNG };

export const run = Date.now().toString(36);
let n = 0;
export const uniqueEmail = () => `e2e-${run}-${n++}@test.dev`;
export const PASSWORD = 'pw123456';

export interface Session {
  token: string;
  userId: string;
  email: string;
}

/** Registers and logs in through the API (fast, and keeps the UI specs under the auth rate limit). */
export async function registerUser(request: APIRequestContext): Promise<Session> {
  const email = uniqueEmail();
  const signup = await request.post('/api/user/signup', { data: { email, password: PASSWORD } });
  if (!signup.ok()) throw new Error(`signup failed: ${signup.status()}`);
  const login = await request.post('/api/user/login', { data: { email, password: PASSWORD } });
  if (!login.ok()) throw new Error(`login failed: ${login.status()}`);
  const body = await login.json();
  return { email, token: body.token, userId: body.userId };
}

/** Starts the page already logged in, exactly as if the user had logged in earlier. */
export async function startLoggedIn(page: Page, session: Session) {
  await page.addInitScript(
    ([key, value]) => localStorage.setItem(key, value),
    [
      'meanstack.session',
      JSON.stringify({
        token: session.token,
        userId: session.userId,
        expiresAt: Date.now() + 3_600_000,
      }),
    ],
  );
}

export async function createPostViaApi(
  request: APIRequestContext,
  session: Session,
  title: string,
) {
  const res = await request.post('/api/posts', {
    headers: { Authorization: `Bearer ${session.token}` },
    multipart: { title, content: 'Seeded through the API', image: PNG_FILE },
  });
  if (!res.ok()) throw new Error(`create post failed: ${res.status()}`);
  return (await res.json()).post as { id: string; imagePath: string };
}

export async function deleteAllPostsOf(request: APIRequestContext, session: Session) {
  const list = await (await request.get('/api/posts')).json();
  for (const post of list.posts.filter((p: { creator: string }) => p.creator === session.userId)) {
    await request.delete(`/api/posts/${post._id}`, {
      headers: { Authorization: `Bearer ${session.token}` },
    });
  }
}
