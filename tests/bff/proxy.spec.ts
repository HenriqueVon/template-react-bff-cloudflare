import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest as proxy } from '../../functions/api/[[path]]';
import { buildRequest, call, env, jsonUpstream, mockFetch, setCookies, upstreamCall } from './helpers';

const ACCESS_COOKIE = '__Host-app_at=placeholder.access.token';

function get(path: string, segments: string[], extra: { cookie?: string; headers?: Record<string, string> } = {}) {
  const request = buildRequest(`/api/${path}`, { method: 'GET', origin: null, csrf: false, cookie: extra.cookie ?? ACCESS_COOKIE, headers: extra.headers });
  return call(proxy, request, { path: segments });
}

describe('API proxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('allowlist', () => {
    it.each([
      ['auth/me', ['auth', 'me']],
      // @template:example:start
      ['examples', ['examples']],
      ['examples/abc123', ['examples', 'abc123']],
      // @template:example:end
    ])('should forward %s', async (path, segments) => {
      const fetchMock = mockFetch(jsonUpstream(200, { items: [], total: 0 }));

      const response = await get(path, segments);

      expect(response.status).toBe(200);
      expect(upstreamCall(fetchMock).url).toBe(`https://api.test/v1/api/${path}`);
    });

    it.each([
      ['the refresh route, which has its own function', ['auth', 'refresh']],
      ['the login route, which has its own function', ['auth', 'login']],
      ['the logout routes', ['auth', 'logout-all']],
      ['another auth route', ['auth', 'me', 'extra']],
      ['health', ['health']],
      ['an unknown resource', ['secrets']],
      ['a deeper path', ['examples', 'abc123', 'items']],
      ['a path with a dot segment', ['examples', '.']],
      ['a path that climbs', ['examples', '..', 'auth', 'refresh']],
      ['an empty segment', ['examples', '']],
      ['no path at all', []],
    ])('should answer 404 and call nothing for %s', async (_name, segments) => {
      const fetchMock = mockFetch(jsonUpstream(200, {}));

      const response = await get(segments.join('/'), segments);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ message: 'Not found', code: 'NOT_FOUND' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    // @template:example:start
    it('should encode each segment, so an encoded slash cannot change the path', async () => {
      const fetchMock = mockFetch(jsonUpstream(200, {}));

      await get('examples/a%2Fb', ['examples', 'a/b']);

      expect(upstreamCall(fetchMock).url).toBe('https://api.test/v1/api/examples/a%2Fb');
    });
    // @template:example:end

    it.each(['PUT', 'OPTIONS', 'HEAD'])('should refuse the %s method with 405', async (method) => {
      const fetchMock = mockFetch(jsonUpstream(200, {}));
      const request = buildRequest('/api/auth/me', { method, cookie: ACCESS_COOKIE });

      const response = await call(proxy, request, { path: ['auth', 'me'] });

      expect(response.status).toBe(405);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('forwarding', () => {
    it('should add the API key and the access cookie as the Bearer token, and never forward the browser cookie', async () => {
      const fetchMock = mockFetch(jsonUpstream(200, { items: [], total: 0 }));

      await get('auth/me', ['auth', 'me'], { headers: { Authorization: 'Bearer from-the-browser', 'x-api-key': 'from-the-browser' } });

      const { headers } = upstreamCall(fetchMock);
      expect(headers.get('x-api-key')).toBe('placeholder-api-key');
      expect(headers.get('Authorization')).toBe('Bearer placeholder.access.token');
      expect(headers.get('Cookie')).toBeNull();
    });

    it('should forward the query string as it came', async () => {
      const fetchMock = mockFetch(jsonUpstream(200, { items: [], total: 0 }));
      const request = buildRequest('/api/auth/me?limit=20&offset=40&orderBy=name&orderDirection=desc', {
        method : 'GET', origin : null, csrf : false, cookie : ACCESS_COOKIE,
      });

      await call(proxy, request, { path: ['auth', 'me'] });

      expect(upstreamCall(fetchMock).url).toBe('https://api.test/v1/api/auth/me?limit=20&offset=40&orderBy=name&orderDirection=desc');
    });

    it('should forward the method, the body and the content type of a write', async () => {
      const fetchMock = mockFetch(jsonUpstream(201, { id: 'new' }));
      const body = JSON.stringify({ name: 'First example' });

      const response = await call(proxy, buildRequest('/api/auth/me', { body, cookie: ACCESS_COOKIE }), { path: ['auth', 'me'] });

      const { init, headers } = upstreamCall(fetchMock);
      expect(response.status).toBe(201);
      expect(init.method).toBe('POST');
      expect(new TextDecoder().decode(init.body as ArrayBuffer)).toBe(body);
      expect(headers.get('Content-Type')).toBe('application/json');
    });

    it('should send the device of the browser from CF-Connecting-IP and its user agent', async () => {
      const fetchMock = mockFetch(jsonUpstream(200, {}));

      await get('auth/me', ['auth', 'me'], { headers: { 'CF-Connecting-IP': '203.0.113.7', 'X-Forwarded-For': '198.51.100.1', 'User-Agent': 'Mozilla/5.0 (placeholder)' } });

      const { headers } = upstreamCall(fetchMock);
      expect(headers.get('X-End-User-IP')).toBe('203.0.113.7');
      expect(headers.get('X-End-User-Agent')).toBe('Mozilla/5.0 (placeholder)');
      expect(headers.get('X-Forwarded-For')).toBeNull();
    });
  });

  describe('session', () => {
    it('should answer 401 AUTH_TOKEN_EXPIRED without calling the API when the access cookie is gone', async () => {
      const fetchMock = mockFetch(jsonUpstream(200, {}));

      const response = await get('auth/me', ['auth', 'me'], { cookie: '__Host-app_rt=session-1.placeholder-secret' });

      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ message: 'Token expired', code: 'AUTH_TOKEN_EXPIRED' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      [401, { message: 'Token expired', code: 'AUTH_TOKEN_EXPIRED' }],
      [403, { message: 'Forbidden', code: 'FORBIDDEN' }],
      [409, { message: 'Resource already exists', code: 'CONFLICT' }],
      [503, { message: 'The service cannot be reached', code: 'API_UNAVAILABLE' }],
    ])('should pass %s through with its body', async (status, body) => {
      mockFetch(jsonUpstream(status, body));

      const response = await get('auth/me', ['auth', 'me']);

      expect(response.status).toBe(status);
      expect(await response.json()).toEqual(body);
    });

    it('should pass a 204 through without a body, and Retry-After on a 429', async () => {
      mockFetch(new Response(null, { status: 204 }));
      const deleted = await call(proxy, buildRequest('/api/auth/me', { method: 'DELETE', cookie: ACCESS_COOKIE }), { path: ['auth', 'me'] });
      expect(deleted.status).toBe(204);
      expect(await deleted.text()).toBe('');

      mockFetch(jsonUpstream(429, { message: 'Too many attempts', code: 'RATE_LIMITED' }, { 'Retry-After': '30' }));
      const limited = await get('auth/me', ['auth', 'me']);
      expect(limited.status).toBe(429);
      expect(limited.headers.get('Retry-After')).toBe('30');
    });

    it('should never pass a Set-Cookie of the API to the browser, and always send no-store', async () => {
      mockFetch(jsonUpstream(200, {}, { 'Set-Cookie': 'tracking=1', 'X-Internal': 'leak' }));

      const response = await get('auth/me', ['auth', 'me']);

      expect(setCookies(response)).toEqual([]);
      expect(response.headers.get('X-Internal')).toBeNull();
      expect(response.headers.get('Cache-Control')).toBe('no-store');
    });

    it('should answer 503 without a token problem when the API cannot be reached', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      mockFetch(new TypeError('fetch failed'));

      const response = await get('auth/me', ['auth', 'me']);

      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ message: 'The service cannot be reached', code: 'API_UNAVAILABLE' });
    });

    it('should answer 500 and name the missing variable when the server is not configured', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const fetchMock = mockFetch(jsonUpstream(200, {}));
      const request = buildRequest('/api/auth/me', { method: 'GET', origin: null, csrf: false, cookie: ACCESS_COOKIE });

      const response = await call(proxy, request, { path: ['auth', 'me'] }, { ...env, API_KEY: '' });

      expect(response.status).toBe(500);
      expect(await response.json()).toEqual({ message: 'The server is not configured', code: 'BFF_MISCONFIGURED' });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('CSRF', () => {
    it.each([
      ['no X-Requested-With', { csrf: false }],
      ['another origin', { origin: 'https://evil.test' }],
      ['no Origin', { origin: null }],
    ])('should refuse a write with %s', async (_name, options) => {
      const fetchMock = mockFetch(jsonUpstream(201, {}));
      const request = buildRequest('/api/auth/me', { body: '{}', cookie: ACCESS_COOKIE, ...options });

      const response = await call(proxy, request, { path: ['auth', 'me'] });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: 'CSRF_REJECTED' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should let a read through without the CSRF header, because it changes nothing', async () => {
      mockFetch(jsonUpstream(200, { items: [], total: 0 }));

      const response = await get('auth/me', ['auth', 'me']);

      expect(response.status).toBe(200);
    });
  });
});
