import { expect, test } from '@playwright/test';
import { AFTER_EXPIRY_MS, DEMO, openUserMenu, signIn } from './support';

test.describe('the session, in a real browser', () => {
  test('signs in, shows who is signed in, and signs out for good', async ({ page }) => {
    await signIn(page);

    await openUserMenu(page);
    const menu = page.getByRole('menu');
    await expect(menu.getByText(DEMO.name)).toBeVisible();
    await expect(menu.getByText(DEMO.email)).toBeVisible();

    await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);

    // The cookies are gone, so a reload does not bring the session back.
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Overview' })).toHaveCount(0);
  });

  test('sends a visitor without a session to the login', async ({ page }) => {
    await page.goto('/some-page-that-does-not-exist');

    await expect(page).toHaveURL(/\/login$/);
  });

  test('renews the session by itself when the access token expires', async ({ page }) => {
    await signIn(page);

    await page.waitForTimeout(AFTER_EXPIRY_MS);
    await page.reload();

    // The access cookie expired: the first call got 401, the app refreshed once and went on.
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);
  });

  test('two tabs that find the token expired at the same time do not end the session', async ({ context }) => {
    const first = await context.newPage();
    await signIn(first);
    const second = await context.newPage();
    await second.goto('/');
    await expect(second.getByRole('heading', { name: 'Overview' })).toBeVisible();

    await first.waitForTimeout(AFTER_EXPIRY_MS);

    // Both tabs ask for the session together. Without the lock of the browser, the second refresh would present the refresh
    // token the first one just replaced, and the API would end the whole session as if it had been stolen.
    await Promise.all([first.reload(), second.reload()]);

    await expect(first.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(second.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(first).not.toHaveURL(/\/login/);
    await expect(second).not.toHaveURL(/\/login/);
  });

  test('a logout in one tab closes the other', async ({ context }) => {
    const first = await context.newPage();
    await signIn(first);
    const second = await context.newPage();
    await second.goto('/');
    await expect(second.getByRole('heading', { name: 'Overview' })).toBeVisible();

    await openUserMenu(first);
    await first.getByRole('menuitem', { name: 'Sign out', exact: true }).click();

    await expect(second).toHaveURL(/\/login$/);
  });

  test('a logout while another tab is refreshing leaves no cookie of the session behind', async ({ context }) => {
    const first = await context.newPage();
    await signIn(first);
    const second = await context.newPage();
    await second.goto('/');
    await expect(second.getByRole('heading', { name: 'Overview' })).toBeVisible();

    await first.waitForTimeout(AFTER_EXPIRY_MS);

    // The first tab refreshes, and the fake API answers late (playwright.config.ts). The second tab signs out meanwhile.
    // Without the lock the logout would clear the cookies first, and the late answer of the refresh would set new ones
    // after it: the user would have left, and the browser would still hold a session.
    const refreshSent = first.waitForRequest('**/api/auth/refresh');
    const refreshAnswered = first.waitForResponse('**/api/auth/refresh');
    await first.reload({ waitUntil: 'commit' });
    await refreshSent;

    await openUserMenu(second);
    await second.getByRole('menuitem', { name: 'Sign out', exact: true }).click();

    await expect(second).toHaveURL(/\/login$/);
    await expect(first).toHaveURL(/\/login$/);

    // The check has to wait for the late answer, or it would pass before the cookies are set.
    await refreshAnswered;
    await first.waitForTimeout(500);

    const names = (await context.cookies()).map((cookie) => cookie.name);
    expect(names.filter((name) => name.startsWith('__Host-app_'))).toEqual([]);
  });

  test('keeps the session and offers to try again when the API is unavailable', async ({ page }) => {
    await signIn(page);

    await page.route('**/api/auth/me', (route) => route.fulfill({ status: 503, json: { message: 'The service cannot be reached', code: 'API_UNAVAILABLE' } }));
    await page.reload();

    // A 503 is not a session problem: no login page, a message and a way to try again.
    await expect(page.getByRole('heading', { name: 'Unavailable' })).toBeVisible();
    await expect(page).not.toHaveURL(/\/login/);

    await page.unroute('**/api/auth/me');
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  });

  test('a logout without a connection keeps the session and says so, instead of pretending the user left', async ({ context, page }) => {
    await signIn(page);

    await context.setOffline(true);
    await openUserMenu(page);
    await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click();

    await expect(page.getByText('No connection to the server. Check your internet and try again.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

    // Back online, the same button works, and a reload does not bring the session back.
    await context.setOffline(false);
    await openUserMenu(page);
    await page.getByRole('menuitem', { name: 'Sign out', exact: true }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.reload();
    await expect(page).toHaveURL(/\/login$/);
  });
});
