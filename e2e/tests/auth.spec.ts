import { expect, test } from '@playwright/test';
import { PASSWORD, uniqueEmail } from './support';

test.describe('authentication', () => {
  test('anonymous users are sent to the login page for protected routes', async ({ page }) => {
    await page.goto('/create');
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('link', { name: 'Signup' })).toBeVisible();
  });

  test.describe.serial('account lifecycle', () => {
    const email = uniqueEmail();

    test('signup validates input, creates the account and moves to login', async ({ page }) => {
      await page.goto('/signup');
      await page.getByRole('button', { name: 'Sign up' }).click();
      await expect(page.getByText('Please enter a valid E-Mail')).toBeVisible();

      await page.getByLabel('E-Mail').fill(email);
      await page.getByLabel('Password').fill(PASSWORD);
      await page.getByRole('button', { name: 'Sign up' }).click();
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByText('Account created')).toBeVisible();
    });

    test('a wrong password shows the API error and keeps the form usable', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('E-Mail').fill(email);
      await page.getByLabel('Password').fill('not-the-password');
      await page.getByRole('button', { name: 'Login' }).click();
      await expect(page.getByText('Auth failed!')).toBeVisible();
      await expect(page).toHaveURL(/\/login$/);
      await expect(page.getByLabel('E-Mail')).toBeVisible(); // spinner gone, form is back
    });

    test('logging in, reloading and logging out', async ({ page }) => {
      await page.goto('/login');
      await page.getByLabel('E-Mail').fill(email);
      await page.getByLabel('Password').fill(PASSWORD);
      await page.getByRole('button', { name: 'Login' }).click();
      await expect(page).toHaveURL('/');
      await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();

      await page.reload();
      await expect(page.getByRole('button', { name: 'Logout' })).toBeVisible();

      await page.getByRole('button', { name: 'Logout' }).click();
      await expect(page.getByRole('link', { name: 'Login' })).toBeVisible();
      await page.goto('/create');
      await expect(page).toHaveURL(/\/login$/);
    });
  });
});
