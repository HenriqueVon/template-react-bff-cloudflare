// The Functions against the fake API, with no mocks: the real handlers call the real server of mock-api/ over HTTP. It
// proves that the BFF and the contract of docs/API-CONTRACT.md agree, which the tests with a mocked fetch cannot show. If
// you change the contract, change docs/API-CONTRACT.md, mock-api/app.mjs and the Functions together, and this test tells
// you when one of them was left behind.
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
// @template:login-google:start
import { onRequestGet as startGoogle } from '../../functions/api/auth/google/start';
import { onRequestPost as exchange } from '../../functions/api/auth/exchange';
// @template:login-google:end
// @template:login-password:start
import { onRequestPost as login } from '../../functions/api/auth/login';
// @template:login-password:end
import { onRequest as proxy } from '../../functions/api/[[path]]';
import { onRequestPost as logout } from '../../functions/api/auth/logout';
import { onRequestPost as logoutAll } from '../../functions/api/auth/logout-all';
import { onRequestPost as refresh } from '../../functions/api/auth/refresh';
import { createMockApi, DEMO_USER } from '../../mock-api/app.mjs';
import type { Env } from '../../server/upstream';

const ORIGIN = 'https://app.test';
const API_KEY = 'contract-test-api-key';

let server: Server;
let env: Env;

beforeAll(async () => {
  server = createMockApi({ apiKey: API_KEY, accessTtlSeconds: 900, allowedRedirectHosts: ['app.test'] });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;

  env = {
    API_URL : `http://127.0.0.1:${port}/v1/api`,
    API_KEY,
    // @template:login-google:start
    AUTH_PUBLIC_URL : `http://127.0.0.1:${port}`,
    AUTH_CLIENT_ID  : 'contract-test-client',
    // @template:login-google:end
  };
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

// What a browser would keep: the cookies of the Set-Cookie headers, by name. A cookie with Max-Age=0 is removed.
class Browser {
  readonly cookies = new Map<string, string>();

  store(response: Response) {
    for (const header of response.headers.getSetCookie()) {
      const [pair, ...attributes] = header.split('; ');
      const separator = pair.indexOf('=');
      const name = pair.slice(0, separator);
      const value = pair.slice(separator + 1);

      if (attributes.includes('Max-Age=0')) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  request(path: string, method: string, body?: unknown): Request {
    const headers = new Headers({ Origin: ORIGIN, 'X-Requested-With': 'my-web-app' });
    if (body !== undefined) headers.set('Content-Type', 'application/json');
    if (this.cookies.size > 0) headers.set('Cookie', [...this.cookies].map(([name, value]) => `${name}=${value}`).join('; '));

    return new Request(`${ORIGIN}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  }

  async call(handler: (context: never) => Response | Promise<Response>, path: string, method: string, body?: unknown, params: Record<string, string | string[]> = {}) {
    const response = await handler({ request: this.request(path, method, body), env, params } as never);
    this.store(response);

    return response;
  }

  api(path: string[], method = 'GET', body?: unknown) {
    return this.call(proxy as never, `/api/${path.join('/')}`, method, body, { path });
  }
}

// What the session looks like to the browser: the access token and the refresh token never appear in a body.
async function expectNoTokenInBody(response: Response) {
  const text = await response.clone().text();
  expect(text).not.toContain('at_');
  expect(text).not.toContain('refreshToken');
}

// @template:login-google:start
// The whole Google login with the fake sign-in service, ending with the session cookies in the browser.
async function signInWithGoogle(browser: Browser) {
  const started = await browser.call(startGoogle as never, '/api/auth/google/start', 'GET');
  const consent = await fetch(started.headers.get('Location') as string, { redirect: 'manual' });
  const callback = new URL(consent.headers.get('Location') as string);

  return browser.call(exchange as never, '/api/auth/exchange', 'POST', {
    code  : callback.searchParams.get('code'),
    state : callback.searchParams.get('state'),
  });
}
// @template:login-google:end

// A browser with a session, by whichever login the project has.
async function signedIn() {
  const browser = new Browser();
  // @template:login-password:start
  await browser.call(login as never, '/api/auth/login', 'POST', { email: DEMO_USER.email, password: DEMO_USER.password });
  // @template:login-password:end
  // @template:login-google:start
  await signInWithGoogle(browser);
  // @template:login-google:end

  return browser;
}

describe('the session against the fake API', () => {
  it('should sign in, read the user and sign out', async () => {
    const browser = await signedIn();
    expect([...browser.cookies.keys()].sort()).toEqual(['__Host-app_at', '__Host-app_rt']);

    const me = await browser.api(['auth', 'me']);
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ id: DEMO_USER.id, name: DEMO_USER.name, email: DEMO_USER.email });

    const out = await browser.call(logout as never, '/api/auth/logout', 'POST');
    expect(out.status).toBe(204);
    expect(browser.cookies.size).toBe(0);
  });

  it('should rotate the refresh token, and end the whole session when a replaced one is used again', async () => {
    const browser = await signedIn();
    const oldRefreshCookie = browser.cookies.get('__Host-app_rt');

    const renewed = await browser.call(refresh as never, '/api/auth/refresh', 'POST');
    expect(renewed.status).toBe(200);
    await expectNoTokenInBody(renewed);
    expect(browser.cookies.get('__Host-app_rt')).not.toBe(oldRefreshCookie);
    expect((await browser.api(['auth', 'me'])).status).toBe(200);

    // Another browser, or an attacker, presents the replaced token.
    const replay = new Browser();
    replay.cookies.set('__Host-app_rt', oldRefreshCookie as string);
    const reused = await replay.call(refresh as never, '/api/auth/refresh', 'POST');
    expect(reused.status).toBe(401);
    expect(await reused.json()).toMatchObject({ code: 'AUTH_SESSION_REVOKED' });
    expect(replay.cookies.size).toBe(0);

    // The session of the honest browser ended with it.
    const next = await browser.call(refresh as never, '/api/auth/refresh', 'POST');
    expect(next.status).toBe(401);
  });

  it('should end every session of the user with logout-all', async () => {
    const first = await signedIn();
    const second = await signedIn();

    const response = await first.call(logoutAll as never, '/api/auth/logout-all', 'POST');
    expect(response.status).toBe(204);
    expect(first.cookies.size).toBe(0);

    expect((await second.api(['auth', 'me'])).status).toBe(401);
  });

  it('should answer AUTH_TOKEN_EXPIRED when the browser has no access cookie, so the app refreshes', async () => {
    const browser = new Browser();

    const response = await browser.api(['auth', 'me']);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: 'Token expired', code: 'AUTH_TOKEN_EXPIRED' });
  });
});

// @template:login-password:start
describe('the password login against the fake API', () => {
  it('should keep the tokens out of the body of the answer', async () => {
    const browser = new Browser();

    const response = await browser.call(login as never, '/api/auth/login', 'POST', { email: DEMO_USER.email, password: DEMO_USER.password });

    expect(response.status).toBe(200);
    await expectNoTokenInBody(response);
  });

  it('should refuse a wrong password and set no cookie', async () => {
    const browser = new Browser();

    const response = await browser.call(login as never, '/api/auth/login', 'POST', { email: DEMO_USER.email, password: 'wrong-password' });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'AUTH_INVALID_CREDENTIALS' });
    expect(browser.cookies.size).toBe(0);
  });

  it('should ask the user to wait after too many wrong passwords, with Retry-After', async () => {
    const browser = new Browser();
    const body = { email: 'someone-else@example.com', password: 'wrong-password' };

    for (let attempt = 0; attempt < 5; attempt += 1) await browser.call(login as never, '/api/auth/login', 'POST', body);
    const blocked = await browser.call(login as never, '/api/auth/login', 'POST', body);

    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('30');
  });
});
// @template:login-password:end

// @template:login-google:start
describe('the Google login against the fake API', () => {
  it('should run the whole PKCE flow and end signed in', async () => {
    const browser = new Browser();

    // 1. The browser asks the Function to start; it answers with the redirect to the sign-in service and the PKCE cookie.
    const started = await browser.call(startGoogle as never, '/api/auth/google/start', 'GET');
    expect(started.status).toBe(302);
    expect([...browser.cookies.keys()]).toEqual(['__Host-app_pkce']);

    // 2. The sign-in service (the fake one) sends the browser back to the callback with a code and the state.
    const consent = await fetch(started.headers.get('Location') as string, { redirect: 'manual' });
    expect(consent.status).toBe(302);
    const callback = new URL(consent.headers.get('Location') as string);
    expect(`${callback.origin}${callback.pathname}`).toBe(`${ORIGIN}/auth/callback`);

    // 3. The callback page sends the code and the state to the exchange.
    const exchanged = await browser.call(exchange as never, '/api/auth/exchange', 'POST', {
      code  : callback.searchParams.get('code'),
      state : callback.searchParams.get('state'),
    });
    expect(exchanged.status).toBe(200);
    await expectNoTokenInBody(exchanged);
    expect([...browser.cookies.keys()].sort()).toEqual(['__Host-app_at', '__Host-app_rt']);

    expect((await browser.api(['auth', 'me'])).status).toBe(200);
  });

  it('should refuse a code used twice', async () => {
    const browser = new Browser();
    const started = await browser.call(startGoogle as never, '/api/auth/google/start', 'GET');
    const pkceCookie = browser.cookies.get('__Host-app_pkce') as string;
    const callback = new URL((await fetch(started.headers.get('Location') as string, { redirect: 'manual' })).headers.get('Location') as string);
    const body = { code: callback.searchParams.get('code'), state: callback.searchParams.get('state') };

    expect((await browser.call(exchange as never, '/api/auth/exchange', 'POST', body)).status).toBe(200);

    const again = new Browser();
    again.cookies.set('__Host-app_pkce', pkceCookie);
    const second = await again.call(exchange as never, '/api/auth/exchange', 'POST', body);
    expect(second.status).toBe(401);
    expect(await second.json()).toMatchObject({ code: 'AUTH_CODE_INVALID' });
    expect(again.cookies.has('__Host-app_at')).toBe(false);
  });

  it('should refuse a code that was made for another verifier', async () => {
    const browser = new Browser();
    const started = await browser.call(startGoogle as never, '/api/auth/google/start', 'GET');
    const callback = new URL((await fetch(started.headers.get('Location') as string, { redirect: 'manual' })).headers.get('Location') as string);

    // Another login in progress has its own verifier and state: the state the page sends is not the one of this cookie.
    const other = new Browser();
    await other.call(startGoogle as never, '/api/auth/google/start', 'GET');
    const response = await other.call(exchange as never, '/api/auth/exchange', 'POST', {
      code  : callback.searchParams.get('code'),
      state : callback.searchParams.get('state'),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'LOGIN_STATE_INVALID' });
  });

  it('should not redirect to an address that is not a registered redirect URL', async () => {
    const start = new URL(`${env.AUTH_PUBLIC_URL}/v1/api/auth/google`);
    start.searchParams.set('client_id', 'contract-test-client');
    start.searchParams.set('redirect_uri', 'https://evil.test/auth/callback');
    start.searchParams.set('state', 'a'.repeat(22));
    start.searchParams.set('code_challenge', 'b'.repeat(43));
    start.searchParams.set('code_challenge_method', 'S256');

    const response = await fetch(start, { redirect: 'manual' });

    expect(response.status).toBe(400);
  });
});
// @template:login-google:end

// @template:example:start
describe('the example resource through the proxy', () => {
  it('should list, create, edit and delete', async () => {
    const browser = await signedIn();

    const created = await browser.api(['examples'], 'POST', { name: 'Contract example', description: null });
    expect(created.status).toBe(201);
    const example = await created.json() as { id: string; name: string };

    const edited = await browser.api(['examples', example.id], 'PATCH', { description: 'Edited' });
    expect(await edited.json()).toMatchObject({ id: example.id, name: 'Contract example', description: 'Edited' });

    const listed = await browser.api(['examples']);
    const page = await listed.json() as { items: { id: string }[]; total: number };
    expect(page.items.some((item) => item.id === example.id)).toBe(true);
    expect(page.total).toBeGreaterThanOrEqual(1);

    expect((await browser.api(['examples', example.id], 'DELETE')).status).toBe(204);
    expect((await browser.api(['examples', example.id])).status).toBe(404);
  });

  it('should refuse a name that already exists, and an invalid body with the list of issues', async () => {
    const browser = await signedIn();
    await browser.api(['examples'], 'POST', { name: 'Unique name' });

    const duplicate = await browser.api(['examples'], 'POST', { name: 'unique name' });
    expect(duplicate.status).toBe(409);
    expect(await duplicate.json()).toMatchObject({ code: 'CONFLICT' });

    const invalid = await browser.api(['examples'], 'POST', { name: 'ab' });
    expect(invalid.status).toBe(400);
    const body = await invalid.json() as { issues: { path: string }[] };
    expect(body.issues[0].path).toBe('name');
  });

  it('should page the list with limit and offset', async () => {
    const browser = await signedIn();

    const response = await browser.api(['examples']);
    const all = await response.json() as { items: unknown[]; total: number };

    const page = await (await browser.call(proxy as never, '/api/examples?limit=2&offset=1', 'GET', undefined, { path: ['examples'] })).json() as { items: unknown[]; total: number };
    expect(page.items).toHaveLength(Math.min(2, Math.max(0, all.total - 1)));
    expect(page.total).toBe(all.total);
  });
});
// @template:example:end

describe('the API key', () => {
  it('should be required by the fake API, so a Function without the key cannot work', async () => {
    const response = await fetch(`${env.API_URL}/auth/me`, { headers: { Authorization: 'Bearer anything' } });

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
