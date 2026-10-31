import { expect, test } from '@playwright/test';
import {
  NOT_AN_IMAGE,
  PNG_FILE,
  Session,
  createPostViaApi,
  deleteAllPostsOf,
  registerUser,
  run,
  startLoggedIn,
} from './support';

test.describe.serial('posts', () => {
  let owner: Session;
  let other: Session;

  test.beforeAll(async ({ playwright, baseURL }) => {
    const api = await playwright.request.newContext({ baseURL });
    owner = await registerUser(api);
    other = await registerUser(api);
    await api.dispose();
  });

  test.beforeEach(async ({ page }) => {
    await startLoggedIn(page, owner);
  });

  const title = (name: string) => `${name} ${run}`;

  test('the new-post form validates the image, then publishes', async ({ page }) => {
    await page.goto('/create');
    await page.getByRole('button', { name: 'Save post' }).click();
    await expect(page.getByText('Please pick an image.')).toBeVisible();

    await page.setInputFiles('input[type=file]', NOT_AN_IMAGE);
    await expect(page.getByText('Only PNG and JPEG images are allowed.')).toBeVisible();

    await page.setInputFiles('input[type=file]', PNG_FILE);
    await expect(page.getByText('Only PNG and JPEG')).toBeHidden();
    await expect(page.getByRole('img', { name: 'Post image preview' })).toBeVisible();

    await page.getByLabel('Post title').fill(title('First'));
    await page.getByLabel('Post content').fill('Hello from Playwright');
    await page.getByRole('button', { name: 'Save post' }).click();

    await expect(page).toHaveURL('/');
    await expect(page.getByText(title('First'))).toBeVisible();
  });

  test('a post shows its image and content, with edit and delete for its owner only', async ({
    page,
    browser,
  }) => {
    await page.goto('/');
    await page.getByText(title('First')).click();
    await expect(page.getByText('Hello from Playwright')).toBeVisible();
    const img = page.getByRole('img', { name: title('First') });
    await expect(img).toBeVisible();
    await expect
      .poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0))
      .toBe(true);
    await expect(page.getByRole('link', { name: 'Edit' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Delete' })).toBeVisible();

    const strangerPage = await (await browser.newContext({ baseURL: page.url() })).newPage();
    await startLoggedIn(strangerPage, other);
    await strangerPage.goto('/');
    await strangerPage.getByText(title('First')).click();
    await expect(strangerPage.getByText('Hello from Playwright')).toBeVisible();
    await expect(strangerPage.getByRole('link', { name: 'Edit' })).toHaveCount(0);
    await expect(strangerPage.getByRole('button', { name: 'Delete' })).toHaveCount(0);
    await strangerPage.context().close();
  });

  test('editing keeps the existing image, and a new image replaces it', async ({ page }) => {
    await page.goto('/');
    await page.getByText(title('First')).click();
    const before = await page.getByRole('img', { name: title('First') }).getAttribute('src');

    await page.getByRole('link', { name: 'Edit' }).click();
    await expect(page.getByLabel('Post title')).toHaveValue(title('First'));
    await page.getByLabel('Post title').fill(title('Edited'));
    await page.getByRole('button', { name: 'Save post' }).click();
    await expect(page).toHaveURL('/');
    await page.getByText(title('Edited')).click();
    await expect(page.getByRole('img', { name: title('Edited') })).toHaveAttribute('src', before!);

    await page.getByRole('link', { name: 'Edit' }).click();
    await page.setInputFiles('input[type=file]', PNG_FILE);
    await page.getByRole('button', { name: 'Save post' }).click();
    await expect(page).toHaveURL('/');
    await page.getByText(title('Edited')).click();
    await expect(page.getByRole('img', { name: title('Edited') })).not.toHaveAttribute(
      'src',
      before!,
    );
  });

  test('deleting removes the post', async ({ page }) => {
    await page.goto('/');
    await page.getByText(title('Edited')).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(title('Edited'))).toHaveCount(0);
  });

  test('deleting the last post of a later page steps back to the previous page', async ({
    page,
    playwright,
    baseURL,
  }) => {
    const api = await playwright.request.newContext({ baseURL });
    await deleteAllPostsOf(api, owner);
    for (const name of ['Oldest', 'Middle', 'Newest']) {
      await createPostViaApi(api, owner, title(name));
    }
    await api.dispose();

    await page.goto('/');
    await page.getByRole('combobox', { name: /items per page/i }).click({ force: true });
    await page.getByRole('option', { name: '2', exact: true }).click();
    await expect(page.getByText(title('Newest'))).toBeVisible();
    await expect(page.getByText(title('Middle'))).toBeVisible();

    await page.getByRole('button', { name: 'Next page' }).click();
    await expect(page.getByText(title('Oldest'))).toBeVisible();
    await expect(page.getByText(title('Newest'))).toHaveCount(0);

    await page.getByText(title('Oldest')).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText(title('Newest'))).toBeVisible();
    await expect(page.getByText(title('Middle'))).toBeVisible();
    await expect(page.getByText(title('Oldest'))).toHaveCount(0);
  });
});
