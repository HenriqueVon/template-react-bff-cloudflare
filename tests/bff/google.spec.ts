import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestGet as start, onRequest as startAnyMethod } from '../../functions/api/auth/google/start';
import { onRequestPost as exchange } from '../../functions/api/auth/exchange';
import { challengeOf } from '../../server/pkce';
import { buildRequest, call, cookieValue, env, jsonUpstream, mockFetch, ORIGIN, setCookies, tokens, upstreamCall } from './helpers';

const PKCE = '__Host-app_pkce';

// Runs the start and returns what the browser would keep and send back.
async function startLogin() {
  const response = await call(start, buildRequest('/api/auth/google/start', { method: 'GET', origin: null, csrf: false }));
  const cookies = setCookies(response);
  const [verifier, state] = (cookieValue(cookies, PKCE) ?? '').split('.');

  return { response, cookies, verifier, state, cookie: `${PKCE}=${verifier}.${state}` };
}

function exchangeRequest(body: unknown, cookie?: string) {
  return buildRequest('/api/auth/exchange', { body: JSON.stringify(body), cookie });
}

describe('GET /api/auth/google/start', () => {
  it('should redirect to the sign-in service with the client, the redirect URI, the state and a S256 challenge', async () => {
    const { response, verifier, state } = await startLogin();

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('Location') ?? '');
    expect(`${location.origin}${location.pathname}`).toBe('https://auth-api.test/v1/api/auth/google');
    expect(location.searchParams.get('client_id')).toBe('placeholder-client-id');
    expect(location.searchParams.get('redirect_uri')).toBe(`${ORIGIN}/auth/callback`);
    expect(location.searchParams.get('state')).toBe(state);
    expect(location.searchParams.get('code_challenge_method')).toBe('S256');
    expect(location.searchParams.get('code_challenge')).toBe(await challengeOf(verifier));
  });

  it('should keep the verifier and the state in a short-lived HttpOnly Lax cookie, never in the URL', async () => {
    const { response, cookies, verifier, state } = await startLogin();

    expect(cookies).toEqual([`${PKCE}=${verifier}.${state}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`]);
    expect(response.headers.get('Location')).not.toContain(verifier);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('should create a new verifier and state for every login', async () => {
    const first = await startLogin();
    const second = await startLogin();

    expect(second.verifier).not.toBe(first.verifier);
    expect(second.state).not.toBe(first.state);
  });

  it('should answer 500 and name the missing variables when the server is not configured', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await call(start, buildRequest('/api/auth/google/start', { method: 'GET' }), {}, { ...env, AUTH_CLIENT_ID: '' });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ message: 'The server is not configured', code: 'BFF_MISCONFIGURED' });
    expect(setCookies(response)).toEqual([]);
    expect(console.error).toHaveBeenCalledWith({ event: 'BFF_MISCONFIGURED', variables: ['AUTH_CLIENT_ID'] });
  });

  it('should refuse any other method', async () => {
    const response = await call(startAnyMethod, buildRequest('/api/auth/google/start', { method: 'POST' }));

    expect(response.status).toBe(405);
    expect(response.headers.get('Allow')).toBe('GET');
  });
});

describe('POST /api/auth/exchange', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should exchange the code with the verifier of the cookie and keep the tokens in HttpOnly cookies only', async () => {
    const { verifier, state, cookie } = await startLogin();
    const fetchMock = mockFetch(jsonUpstream(200, tokens));

    const response = await call(exchange, exchangeRequest({ code: 'placeholder-code', state }, cookie));

    const { url, init, headers } = upstreamCall(fetchMock);
    expect(url).toBe('https://api.test/v1/api/auth/exchange-code');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      code         : 'placeholder-code',
      codeVerifier : verifier,
      redirectUri  : `${ORIGIN}/auth/callback`,
    });
    expect(headers.get('x-api-key')).toBe('placeholder-api-key');
    expect(headers.get('Authorization')).toBeNull();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ expiresIn: 900 });
    expect(setCookies(response)).toEqual([
      `${PKCE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
      '__Host-app_at=placeholder.access.token; Path=/; Max-Age=900; HttpOnly; Secure; SameSite=Strict',
      '__Host-app_rt=session-1.placeholder-secret; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict',
    ]);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('should send the browser IP from CF-Connecting-IP and its user agent, never X-Forwarded-For', async () => {
    const { state, cookie } = await startLogin();
    const fetchMock = mockFetch(jsonUpstream(200, tokens));

    const request = buildRequest('/api/auth/exchange', {
      body    : JSON.stringify({ code: 'placeholder-code', state }),
      cookie,
      headers : { 'CF-Connecting-IP': '203.0.113.7', 'X-Forwarded-For': '198.51.100.1', 'User-Agent': 'Mozilla/5.0 (placeholder)' },
    });
    await call(exchange, request);

    const { headers } = upstreamCall(fetchMock);
    expect(headers.get('X-End-User-IP')).toBe('203.0.113.7');
    expect(headers.get('X-End-User-Agent')).toBe('Mozilla/5.0 (placeholder)');
    expect(headers.get('X-Forwarded-For')).toBeNull();
  });

  it('should refuse a state that is not the one of the cookie, without calling the API', async () => {
    const { cookie } = await startLogin();
    const fetchMock = mockFetch(jsonUpstream(200, tokens));

    const response = await call(exchange, exchangeRequest({ code: 'placeholder-code', state: 'another-state-value-0000' }, cookie));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: 'The login is invalid or expired', code: 'LOGIN_STATE_INVALID' });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setCookies(response)).toEqual([`${PKCE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`]);
  });

  it.each([
    ['no PKCE cookie', undefined],
    ['a malformed PKCE cookie', `${PKCE}=not-a-valid-value`],
  ])('should refuse %s, without calling the API', async (_name, cookie) => {
    const fetchMock = mockFetch(jsonUpstream(200, tokens));

    const response = await call(exchange, exchangeRequest({ code: 'placeholder-code', state: 'any-state-value-00000' }, cookie));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ code: 'LOGIN_STATE_INVALID' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing code', { state: 'any-state-value-00000' }],
    ['an empty code', { code: '', state: 'any-state-value-00000' }],
    ['a code that is too long', { code: 'a'.repeat(257), state: 'any-state-value-00000' }],
    ['a missing state', { code: 'placeholder-code' }],
    ['a state that is not a string', { code: 'placeholder-code', state: 1 }],
  ])('should refuse %s with 400, without calling the API', async (_name, body) => {
    const { cookie } = await startLogin();
    const fetchMock = mockFetch(jsonUpstream(200, tokens));

    const response = await call(exchange, exchangeRequest(body, cookie));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: 'Invalid body', code: 'BAD_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should refuse a body that is not JSON', async () => {
    const { cookie } = await startLogin();
    mockFetch(jsonUpstream(200, tokens));

    const response = await call(exchange, buildRequest('/api/auth/exchange', { body: '{not json', cookie }));

    expect(response.status).toBe(400);
  });

  it('should refuse a cross-site request', async () => {
    const { state, cookie } = await startLogin();
    const fetchMock = mockFetch(jsonUpstream(200, tokens));

    const response = await call(exchange, buildRequest('/api/auth/exchange', {
      body   : JSON.stringify({ code: 'placeholder-code', state }),
      cookie,
      origin : 'https://evil.test',
    }));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'CSRF_REJECTED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should pass AUTH_CODE_INVALID through, set no session cookie and delete the PKCE cookie', async () => {
    const { state, cookie } = await startLogin();
    mockFetch(jsonUpstream(401, { message: 'Invalid code', code: 'AUTH_CODE_INVALID' }));

    const response = await call(exchange, exchangeRequest({ code: 'placeholder-code', state }, cookie));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: 'Invalid code', code: 'AUTH_CODE_INVALID' });
    expect(setCookies(response)).toEqual([`${PKCE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`]);
  });

  it.each([
    [403, 'FORBIDDEN'],
    [429, 'RATE_LIMITED'],
  ])('should pass %s %s through with its code', async (status, code) => {
    const { state, cookie } = await startLogin();
    mockFetch(jsonUpstream(status, { message: 'Refused', code }, status === 429 ? { 'Retry-After': '60' } : {}));

    const response = await call(exchange, exchangeRequest({ code: 'placeholder-code', state }, cookie));

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ message: 'Refused', code });
    expect(response.headers.get('Retry-After')).toBe(status === 429 ? '60' : null);
    expect(setCookies(response).some((entry) => entry.startsWith('__Host-app_at'))).toBe(false);
  });

  it('should answer 503 when the API cannot be reached', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { state, cookie } = await startLogin();
    mockFetch(new TypeError('fetch failed'));

    const response = await call(exchange, exchangeRequest({ code: 'placeholder-code', state }, cookie));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ message: 'The service cannot be reached', code: 'API_UNAVAILABLE' });
    expect(setCookies(response)).toEqual([`${PKCE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`]);
  });

  it('should answer 503 and set no session cookie when the answer is not a set of tokens', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { state, cookie } = await startLogin();
    mockFetch(jsonUpstream(200, { unexpected: true }));

    const response = await call(exchange, exchangeRequest({ code: 'placeholder-code', state }, cookie));

    expect(response.status).toBe(503);
    expect(setCookies(response)).toEqual([`${PKCE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`]);
  });

  it('should not log the code, the verifier or the tokens', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { verifier, state, cookie } = await startLogin();
    mockFetch(new TypeError('fetch failed'));

    await call(exchange, exchangeRequest({ code: 'placeholder-code', state }, cookie));

    const logged = JSON.stringify([...error.mock.calls, ...warn.mock.calls]);
    expect(logged).not.toContain('placeholder-code');
    expect(logged).not.toContain(verifier);
    expect(logged).not.toContain(state);
  });
});
