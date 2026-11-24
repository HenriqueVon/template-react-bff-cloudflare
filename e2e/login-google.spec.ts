import { expect, test } from '@playwright/test';
import { DEMO } from './support';

// The Google login, with the fake sign-in service of the fake API: it signs in the demo user at once, like the real one does
// after Google, and the PKCE flow around it is the real one.
test.describe('the Google login', () => {
  test('runs the whole flow and lands on the home page, with the demo user', async ({ page }) => {
    await page.goto('/login');

    await page.getByRole('button', { name: 'Sign in with Google' }).click();

    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
    await expect(page.getByText(`Welcome, ${DEMO.name}.`)).toBeVisible();
    // The code and the state do not stay in the address bar or in the history.
    expect(page.url()).not.toContain('code=');
    expect(page.url()).not.toContain('state=');
  });

  test('sends the user back to the page they wanted', async ({ page }) => {
    await page.goto('/not-a-page-yet');
    await expect(page).toHaveURL(/\/login$/);

    await page.getByRole('button', { name: 'Sign in with Google' }).click();

    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page).toHaveURL(/\/not-a-page-yet$/);
  });

  test('refuses a return that does not belong to a login in progress', async ({ page }) => {
    await page.goto('/auth/callback?code=made-up&state=made-up-state-value-0000');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('alert')).toHaveText('Could not sign in. Try again.');
  });

  test('refuses a return with an error from the sign-in service', async ({ page }) => {
    await page.goto('/auth/callback?error=access_denied&state=anything');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('alert')).toHaveText('Could not sign in. Try again.');
  });

  test('keeps the PKCE verifier out of the page and of the address', async ({ context, page }) => {
    await page.goto('/login');
    // Stops at the sign-in service to look at what the browser holds in between.
    await page.route('**/v1/api/auth/google*', (route) => route.abort());
    const request = page.waitForRequest('**/v1/api/auth/google*').catch(() => null);

    await page.getByRole('button', { name: 'Sign in with Google' }).click();
    const sent = await request;

    const pkce = (await context.cookies()).find((cookie) => cookie.name === '__Host-app_pkce');
    expect(pkce?.httpOnly).toBe(true);
    expect(pkce?.sameSite).toBe('Lax');
    const verifier = pkce?.value.split('.')[0] ?? '';
    expect(verifier.length).toBeGreaterThanOrEqual(43);
    expect(sent?.url() ?? '').not.toContain(verifier);
    expect(sent?.url() ?? '').toContain('code_challenge_method=S256');
  });
});
