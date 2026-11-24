import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost as refresh } from '../../functions/api/auth/refresh';
import { onRequestPost as logout } from '../../functions/api/auth/logout';
import { onRequestPost as logoutAll } from '../../functions/api/auth/logout-all';
import { buildRequest, call, jsonUpstream, mockFetch, setCookies, tokens, upstreamCall } from './helpers';

const REFRESH_COOKIE = '__Host-app_rt=session-1.placeholder-secret';

const CLEARED = [
  '__Host-app_at=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict',
  '__Host-app_rt=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict',
];

describe('session functions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('POST /api/auth/refresh', () => {
    const newTokens = { ...tokens, accessToken: 'placeholder.new.access', refreshToken: 'session-1.new-secret' };

    it('should send the refresh cookie to the API and replace both cookies', async () => {
      const fetchMock = mockFetch(jsonUpstream(200, newTokens));

      const response = await call(refresh, buildRequest('/api/auth/refresh', { cookie: REFRESH_COOKIE }));

      const { url, init, headers } = upstreamCall(fetchMock);
      expect(url).toBe('https://api.test/v1/api/auth/refresh');
      expect(JSON.parse(init.body as string)).toEqual({ refreshToken: 'session-1.placeholder-secret' });
      expect(headers.get('x-api-key')).toBe('placeholder-api-key');

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ expiresIn: 900 });
      expect(setCookies(response)).toEqual([
        '__Host-app_at=placeholder.new.access; Path=/; Max-Age=900; HttpOnly; Secure; SameSite=Strict',
        '__Host-app_rt=session-1.new-secret; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict',
      ]);
    });

    it('should answer 401 and clear the cookies, without calling the API, when there is no refresh cookie', async () => {
      const fetchMock = mockFetch(jsonUpstream(200, newTokens));

      const response = await call(refresh, buildRequest('/api/auth/refresh'));

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ message: 'No session', code: 'AUTH_SESSION_MISSING' });
      expect(setCookies(response)).toEqual(CLEARED);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      [401, 'AUTH_SESSION_REVOKED'],
      [401, 'AUTH_TOKEN_INVALID'],
      [403, 'FORBIDDEN'],
    ])('should pass %s %s through and clear the cookies: the session is over', async (status, code) => {
      mockFetch(jsonUpstream(status, { message: 'Refused', code }));

      const response = await call(refresh, buildRequest('/api/auth/refresh', { cookie: REFRESH_COOKIE }));

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual({ message: 'Refused', code });
      expect(setCookies(response)).toEqual(CLEARED);
    });

    it.each([
      [429, { message: 'Too many attempts', code: 'RATE_LIMITED' }],
      [503, { message: 'The service cannot be reached', code: 'API_UNAVAILABLE' }],
    ])('should keep the cookies on a temporary failure (%s)', async (status, body) => {
      mockFetch(jsonUpstream(status, body, status === 429 ? { 'Retry-After': '30' } : {}));

      const response = await call(refresh, buildRequest('/api/auth/refresh', { cookie: REFRESH_COOKIE }));

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual(body);
      expect(response.headers.get('Retry-After')).toBe(status === 429 ? '30' : null);
      expect(setCookies(response)).toEqual([]);
    });

    it('should keep the cookies and answer 503 when the API cannot be reached', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mockFetch(new TypeError('fetch failed'));

      const response = await call(refresh, buildRequest('/api/auth/refresh', { cookie: REFRESH_COOKIE }));

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ message: 'The service cannot be reached', code: 'API_UNAVAILABLE' });
      expect(setCookies(response)).toEqual([]);
    });

    it('should refuse a cross-site request', async () => {
      const fetchMock = mockFetch(jsonUpstream(200, newTokens));

      const response = await call(refresh, buildRequest('/api/auth/refresh', { cookie: REFRESH_COOKIE, csrf: false }));

      expect(response.status).toBe(403);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should revoke the session and clear the cookies', async () => {
      const fetchMock = mockFetch(new Response(null, { status: 204 }));

      const response = await call(logout, buildRequest('/api/auth/logout', { cookie: REFRESH_COOKIE }));

      const { url, init } = upstreamCall(fetchMock);
      expect(url).toBe('https://api.test/v1/api/auth/logout');
      expect(JSON.parse(init.body as string)).toEqual({ refreshToken: 'session-1.placeholder-secret' });
      expect(response.status).toBe(204);
      expect(setCookies(response)).toEqual(CLEARED);
    });

    it('should clear the cookies even when the API fails', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mockFetch(new TypeError('fetch failed'));

      const response = await call(logout, buildRequest('/api/auth/logout', { cookie: REFRESH_COOKIE }));

      expect(response.status).toBe(204);
      expect(setCookies(response)).toEqual(CLEARED);
    });

    it('should answer 204 without calling the API when there is no session', async () => {
      const fetchMock = mockFetch(new Response(null, { status: 204 }));

      const response = await call(logout, buildRequest('/api/auth/logout'));

      expect(response.status).toBe(204);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should refuse a cross-site request', async () => {
      const response = await call(logout, buildRequest('/api/auth/logout', { cookie: REFRESH_COOKIE, origin: 'https://evil.test' }));

      expect(response.status).toBe(403);
    });
  });

  describe('POST /api/auth/logout-all', () => {
    it('should revoke every session and clear the cookies on a 204', async () => {
      const fetchMock = mockFetch(new Response(null, { status: 204 }));

      const response = await call(logoutAll, buildRequest('/api/auth/logout-all', { cookie: REFRESH_COOKIE }));

      expect(upstreamCall(fetchMock).url).toBe('https://api.test/v1/api/auth/logout-all');
      expect(response.status).toBe(204);
      expect(setCookies(response)).toEqual(CLEARED);
    });

    it('should pass a failure through and keep the cookies: the other sessions are still open', async () => {
      mockFetch(jsonUpstream(503, { message: 'The service cannot be reached', code: 'API_UNAVAILABLE' }));

      const response = await call(logoutAll, buildRequest('/api/auth/logout-all', { cookie: REFRESH_COOKIE }));

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ message: 'The service cannot be reached', code: 'API_UNAVAILABLE' });
      expect(setCookies(response)).toEqual([]);
    });

    it('should answer 401 and clear the cookies when there is no refresh cookie', async () => {
      const fetchMock = mockFetch(new Response(null, { status: 204 }));

      const response = await call(logoutAll, buildRequest('/api/auth/logout-all'));

      expect(response.status).toBe(401);
      expect(setCookies(response)).toEqual(CLEARED);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
