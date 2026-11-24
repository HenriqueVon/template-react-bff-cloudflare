import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequest as proxy } from '../../functions/api/[[path]]';
import { buildRequest, call, env, jsonUpstream, mockFetch, setCookies, upstreamCall } from './helpers';

// The proxy is tested with routes of its own, so these tests keep their meaning when a project replaces the routes of the
// example with those of its API. The real table is checked by routes.spec.ts.
vi.mock('../../server/routes', () => ({
  ALLOWED_ROUTES: [
    { path: /^auth\/me$/, methods: ['GET'] },
    { path: /^things$/, methods: ['GET', 'POST'] },
    { path: /^things\/[^/]+$/, methods: ['GET', 'PATCH', 'DELETE'] },
  ],
}));

const ACCESS_COOKIE = '__Host-app_at=placeholder.access.token';

function get(path: string, segments: string[], extra: { cookie?: string; headers?: Record<string, string> } = {}) {
  const request = buildRequest(`/api/${path}`, { method: 'GET', origin: null, csrf: false, cookie: extra.cookie ?? ACCESS_COOKIE, headers: extra.headers });
  return call(proxy, request, { path: segments });
}

function write(path: string, segments: string[], method: string, options: { body?: string; csrf?: boolean; origin?: string | null; headers?: Record<string, string> } = {}) {
  return call(proxy, buildRequest(`/api/${path}`, { method, cookie: ACCESS_COOKIE, ...options }), { path: segments });
}

describe('API proxy', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('allowlist', () => {
    it.each([
      ['auth/me', ['auth', 'me']],
      ['things', ['things']],
      ['things/abc123', ['things', 'abc123']],
    ])('should forward a read of %s', async (path, segments) => {
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
      ['a deeper path', ['things', 'abc123', 'items']],
      ['a path with a dot segment', ['things', '.']],
      ['a path that climbs', ['things', '..', 'auth', 'refresh']],
      ['an empty segment', ['things', '']],
      ['no path at all', []],
    ])('should answer 404 and call nothing for %s', async (_name, segments) => {
      const fetchMock = mockFetch(jsonUpstream(200, {}));

      const response = await get(segments.join('/'), segments);

      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ message: 'Not found', code: 'NOT_FOUND' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should encode each segment, so an encoded slash cannot change the path', async () => {
      const fetchMock = mockFetch(jsonUpstream(200, {}));

      await get('things/a%2Fb', ['things', 'a/b']);

      expect(upstreamCall(fetchMock).url).toBe('https://api.test/v1/api/things/a%2Fb');
    });
  });

  describe('methods of each route', () => {
    it.each([
      ['PUT', 'auth/me', ['auth', 'me'], 'GET'],
      ['POST', 'auth/me', ['auth', 'me'], 'GET'],
      ['DELETE', 'auth/me', ['auth', 'me'], 'GET'],
      ['DELETE', 'things', ['things'], 'GET, POST'],
      ['PATCH', 'things', ['things'], 'GET, POST'],
      ['POST', 'things/abc', ['things', 'abc'], 'GET, PATCH, DELETE'],
      ['PUT', 'things/abc', ['things', 'abc'], 'GET, PATCH, DELETE'],
      ['OPTIONS', 'things/abc', ['things', 'abc'], 'GET, PATCH, DELETE'],
      ['HEAD', 'things', ['things'], 'GET, POST'],
    ])('should refuse %s on %s with 405 and say what the route accepts', async (method, path, segments, allow) => {
      const fetchMock = mockFetch(jsonUpstream(200, {}));

      const response = await write(path, segments, method);

      expect(response.status).toBe(405);
      expect(await response.json()).toEqual({ message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
      expect(response.headers.get('Allow')).toBe(allow);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it.each([
      ['POST', 'things', ['things']],
      ['PATCH', 'things/abc', ['things', 'abc']],
      ['DELETE', 'things/abc', ['things', 'abc']],
    ])('should forward %s on %s', async (method, path, segments) => {
      const fetchMock = mockFetch(jsonUpstream(200, {}));

      const response = await write(path, segments, method, { body: '{}' });

      expect(response.status).toBe(200);
      expect(upstreamCall(fetchMock).init.method).toBe(method);
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
      const request = buildRequest('/api/things?limit=20&offset=40&orderBy=name&orderDirection=desc', {
        method : 'GET', origin : null, csrf : false, cookie : ACCESS_COOKIE,
      });

      await call(proxy, request, { path: ['things'] });

      expect(upstreamCall(fetchMock).url).toBe('https://api.test/v1/api/things?limit=20&offset=40&orderBy=name&orderDirection=desc');
    });

    it('should forward the method, the body and the content type of a write', async () => {
      const fetchMock = mockFetch(jsonUpstream(201, { id: 'new' }));
      const body = JSON.stringify({ name: 'First example' });

      const response = await write('things', ['things'], 'POST', { body });

      const { init, headers } = upstreamCall(fetchMock);
      expect(response.status).toBe(201);
      expect(init.method).toBe('POST');
      expect(new TextDecoder().decode(init.body as Uint8Array)).toBe(body);
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

  describe('size of the body', () => {
    const TOO_LARGE = { message: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' };

    it('should forward a body that is as large as the limit allows', async () => {
      const fetchMock = mockFetch(jsonUpstream(201, {}));
      const body = JSON.stringify({ name: 'x'.repeat(1024 * 1024 - 20) });

      const response = await write('things', ['things'], 'POST', { body });

      expect(response.status).toBe(201);
      expect((upstreamCall(fetchMock).init.body as Uint8Array).byteLength).toBe(body.length);
    });

    it('should refuse with 413, reading nothing, a body that declares more than the limit', async () => {
      const fetchMock = mockFetch(jsonUpstream(201, {}));

      const response = await write('things', ['things'], 'POST', { body: '{}', headers: { 'Content-Length': String(1024 * 1024 + 1) } });

      expect(response.status).toBe(413);
      expect(await response.json()).toEqual(TOO_LARGE);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should refuse with 413 a body that has no declared length and grows past the limit', async () => {
      const fetchMock = mockFetch(jsonUpstream(201, {}));
      const chunk = new Uint8Array(512 * 1024).fill(97);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(chunk);
          controller.enqueue(chunk);
          controller.enqueue(chunk);
          controller.close();
        },
      });
      const request = new Request('https://app.test/api/things', {
        method  : 'POST',
        headers : { Origin: 'https://app.test', 'X-Requested-With': 'my-web-app', Cookie: ACCESS_COOKIE, 'Content-Type': 'application/json' },
        body    : stream,
        // @ts-expect-error `duplex` is required by the runtime to send a stream, and is missing from the DOM types.
        duplex  : 'half',
      });

      const response = await call(proxy, request, { path: ['things'] });

      expect(response.status).toBe(413);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should not read a body for a read', async () => {
      const fetchMock = mockFetch(jsonUpstream(200, {}));

      await get('things', ['things']);

      expect(upstreamCall(fetchMock).init.body).toBeUndefined();
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
      const deleted = await write('things/abc', ['things', 'abc'], 'DELETE');
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

      const response = await write('things', ['things'], 'POST', { body: '{}', ...options });

      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: 'CSRF_REJECTED' });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should refuse a cross-site write before saying anything about the route', async () => {
      const response = await write('secrets', ['secrets'], 'POST', { body: '{}', origin: 'https://evil.test' });

      expect(response.status).toBe(403);
    });

    it('should let a read through without the CSRF header, because it changes nothing', async () => {
      mockFetch(jsonUpstream(200, { items: [], total: 0 }));

      const response = await get('auth/me', ['auth', 'me']);

      expect(response.status).toBe(200);
    });
  });
});
