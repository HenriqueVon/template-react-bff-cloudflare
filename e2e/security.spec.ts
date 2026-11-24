import { expect, test } from '@playwright/test';
import { signIn } from './support';

test.describe('the protections, as the browser applies them', () => {
  test('serves the strict Content-Security-Policy and the security headers with the page', async ({ request }) => {
    const response = await request.get('/login');

    const csp = response.headers()['content-security-policy'];
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("style-src 'self'");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).not.toContain('unsafe-inline');
    expect(csp).not.toContain('unsafe-eval');
    expect(response.headers()['x-frame-options']).toBe('DENY');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['referrer-policy']).toBe('no-referrer');
    expect(response.headers()['strict-transport-security']).toContain('max-age=');
  });

  test('breaks nothing under that policy: no violation while signing in and using the app', async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      // The 401 of the session check before the login is expected; anything about the policy is not. Chrome says "Refused
      // to ...", Firefox "Content-Security-Policy: ...".
      if (/content[- ]security[- ]policy|refused to (load|apply|execute|connect)/i.test(message.text())) problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));

    // The browsers word the message differently, so the event is the reliable signal. It survives the reload below.
    await page.exposeFunction('reportCspViolation', (text: string) => problems.push(text));
    await page.addInitScript(() => {
      document.addEventListener('securitypolicyviolation', (event) => {
        void (window as unknown as { reportCspViolation(text: string): Promise<void> })
          .reportCspViolation(`${event.violatedDirective}: ${event.blockedURI}`);
      });
    });

    await signIn(page);
    await page.getByRole('button', { name: 'User menu' }).click();
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 375, height: 812 });
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();

    expect(problems).toEqual([]);
  });

  test('keeps the tokens out of reach of JavaScript: only HttpOnly, Secure, Strict cookies', async ({ context, page }) => {
    await signIn(page);

    const cookies = await context.cookies();
    const session = cookies.filter((cookie) => cookie.name.startsWith('__Host-app_'));
    expect(session.map((cookie) => cookie.name).sort()).toEqual(['__Host-app_at', '__Host-app_rt']);
    for (const cookie of session) {
      expect(cookie.httpOnly, cookie.name).toBe(true);
      expect(cookie.secure, cookie.name).toBe(true);
      expect(cookie.sameSite, cookie.name).toBe('Strict');
      expect(cookie.path, cookie.name).toBe('/');
    }

    // What a script of the page can see: no cookie, nothing in the storage, no token in the page.
    const visible = await page.evaluate(() => ({
      cookie  : document.cookie,
      local   : JSON.stringify({ ...window.localStorage }),
      session : JSON.stringify({ ...window.sessionStorage }),
      html    : document.documentElement.outerHTML,
    }));
    const tokens = session.map((cookie) => cookie.value);
    expect(visible.cookie).toBe('');
    for (const token of tokens) {
      expect(visible.local).not.toContain(token);
      expect(visible.session).not.toContain(token);
      expect(visible.html).not.toContain(token);
    }
  });

  test('refuses a write that comes from another site, before anything else', async ({ page }) => {
    await signIn(page);

    const response = await page.request.post('/api/auth/logout', { headers: { Origin: 'https://evil.example' } });

    expect(response.status()).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'CSRF_REJECTED' });
    // The session is untouched.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  });

  test('does not forward a route or a method the allowlist does not have', async ({ page }) => {
    await signIn(page);
    const headers = { Origin: 'http://localhost:8788', 'X-Requested-With': 'my-web-app' };

    const unknown = await page.request.get('/api/secrets', { headers });
    expect(unknown.status()).toBe(404);

    const wrongMethod = await page.request.delete('/api/auth/me', { headers });
    expect(wrongMethod.status()).toBe(405);
    expect(wrongMethod.headers()['allow']).toBe('GET');

    const login = await page.request.get('/api/auth/refresh', { headers });
    expect(login.status()).not.toBe(200);
  });

  test('never caches what the API answers', async ({ page }) => {
    await signIn(page);

    const response = await page.request.get('/api/auth/me');

    expect(response.status()).toBe(200);
    expect(response.headers()['cache-control']).toBe('no-store');
  });
});
