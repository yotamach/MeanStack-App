import { expect, request as playwrightRequest, test } from '@playwright/test';
import { PNG_FILE, Session, registerUser, startLoggedIn, run } from './support';

test.describe('sessions and refresh tokens', () => {
  let user: Session;

  test.beforeAll(async ({ playwright, baseURL }) => {
    const api = await playwright.request.newContext({ baseURL });
    user = await registerUser(api);
    await api.dispose();
  });

  test('the access token is never stored, and the refresh cookie is httpOnly and scoped to the auth endpoints', async ({
    page,
  }) => {
    await startLoggedIn(page, user);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();

    const stored = await page.evaluate(() => [
      ...Object.values(localStorage),
      ...Object.values(sessionStorage),
      document.cookie,
    ]);
    expect(stored.some((v) => v.includes('eyJ'))).toBe(false); // no JWT anywhere JavaScript can read
    expect(stored.join(' ')).not.toContain('refresh_token');

    const cookie = (await page.context().cookies()).find((c) => c.name === 'refresh_token');
    expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Strict', path: '/api/user' });
  });

  test('a reload restores the session from the cookie', async ({ page }) => {
    await startLoggedIn(page, user);
    await page.goto('/create'); // a guarded route: the guard must see the restored session
    await expect(page).toHaveURL(/\/create$/);
    await page.reload();
    await expect(page).toHaveURL(/\/create$/);
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
  });

  test('an expired access token is refreshed silently and the request replayed', async ({
    page,
  }) => {
    await startLoggedIn(page, user);
    let rejected = 0;
    await page.route('**/api/posts', async (route) => {
      if (route.request().method() === 'POST' && rejected++ === 0) {
        await route.fulfill({ status: 401, json: { message: 'Auth failed!' } }); // as if the token had just expired
      } else {
        await route.continue();
      }
    });
    const refreshes: string[] = [];
    page.on('request', (r) => r.url().endsWith('/api/user/refresh') && refreshes.push(r.url()));

    await page.goto('/create');
    const refreshesAtLoad = refreshes.length; // the startup restore
    await page.setInputFiles('input[type=file]', PNG_FILE);
    await page.getByLabel('Post title').fill(`Refreshed ${run}`);
    await page.getByLabel('Post content').fill('Saved after a silent refresh');
    await page.getByRole('button', { name: 'Save post' }).click();

    await expect(page).toHaveURL('/'); // saved, and the user never saw an error
    await expect(page.getByText(`Refreshed ${run}`)).toBeVisible();
    await expect(page.getByText('Auth failed!')).toHaveCount(0);
    expect(rejected).toBe(2); // rejected once, replayed once
    expect(refreshes.length - refreshesAtLoad).toBe(1);
  });

  test('logging out really ends the session: the old cookie stops working and a reload stays logged out', async ({
    page,
    baseURL,
  }) => {
    await startLoggedIn(page, user);
    await page.goto('/');
    await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();
    const before = (await page.context().cookies()).find((c) => c.name === 'refresh_token')!;

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();

    // Someone who copied the cookie before logout gets nothing out of it.
    const attacker = await playwrightRequest.newContext({
      baseURL,
      extraHTTPHeaders: { Cookie: `refresh_token=${before.value}` },
    });
    expect((await attacker.post('/api/user/refresh')).status()).toBe(401);
    await attacker.dispose();
  });

  test('logging out in one tab logs out the others', async ({ page, context }) => {
    await startLoggedIn(page, user);
    await page.goto('/');
    const other = await context.newPage();
    await other.goto('/');
    await expect(other.getByRole('button', { name: 'Logout' })).toBeVisible();

    await page.getByRole('button', { name: 'Logout' }).click();
    await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
    await expect(other.getByRole('link', { name: 'Login' })).toBeVisible();
  });
});
