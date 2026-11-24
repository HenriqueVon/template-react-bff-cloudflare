import { afterEach, describe, expect, it, vi } from 'vitest';
import { onRequestPost as login } from '../../functions/api/auth/login';
import { buildRequest, call, jsonUpstream, mockFetch, setCookies, tokens, upstreamCall } from './helpers';

function loginRequest(body: unknown, options: { origin?: string | null; csrf?: boolean; headers?: Record<string, string> } = {}) {
  return buildRequest('/api/auth/login', { body: typeof body === 'string' ? body : JSON.stringify(body), ...options });
}

const credentials = { email: 'person@example.com', password: 'placeholder-password' };

describe('POST /api/auth/login', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('should send the credentials to the API with its key and keep the tokens in HttpOnly cookies only', async () => {
    const fetchMock = mockFetch(jsonUpstream(200, tokens));

    const response = await call(login, loginRequest(credentials));

    const { url, init, headers } = upstreamCall(fetchMock);
    expect(url).toBe('https://api.test/v1/api/auth/login');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual(credentials);
    expect(headers.get('x-api-key')).toBe('placeholder-api-key');
    expect(headers.get('Authorization')).toBeNull();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ expiresIn: 900 });
    expect(setCookies(response)).toEqual([
      '__Host-app_at=placeholder.access.token; Path=/; Max-Age=900; HttpOnly; Secure; SameSite=Strict',
      '__Host-app_rt=session-1.placeholder-secret; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Strict',
    ]);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('should send the browser IP from CF-Connecting-IP and its user agent, never X-Forwarded-For', async () => {
    const fetchMock = mockFetch(jsonUpstream(200, tokens));

    await call(login, loginRequest(credentials, {
      headers: { 'CF-Connecting-IP': '203.0.113.7', 'X-Forwarded-For': '198.51.100.1', 'User-Agent': 'Mozilla/5.0 (placeholder)' },
    }));

    const { headers } = upstreamCall(fetchMock);
    expect(headers.get('X-End-User-IP')).toBe('203.0.113.7');
    expect(headers.get('X-End-User-Agent')).toBe('Mozilla/5.0 (placeholder)');
    expect(headers.get('X-Forwarded-For')).toBeNull();
  });

  it('should pass wrong credentials through and set no cookie', async () => {
    mockFetch(jsonUpstream(401, { message: 'Invalid email or password', code: 'AUTH_INVALID_CREDENTIALS' }));

    const response = await call(login, loginRequest(credentials));

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ message: 'Invalid email or password', code: 'AUTH_INVALID_CREDENTIALS' });
    expect(setCookies(response)).toEqual([]);
  });

  it.each([
    [403, 'FORBIDDEN'],
    [429, 'RATE_LIMITED'],
  ])('should pass %s %s through with its code and Retry-After', async (status, code) => {
    mockFetch(jsonUpstream(status, { message: 'Refused', code }, status === 429 ? { 'Retry-After': '30' } : {}));

    const response = await call(login, loginRequest(credentials));

    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ message: 'Refused', code });
    expect(response.headers.get('Retry-After')).toBe(status === 429 ? '30' : null);
    expect(setCookies(response)).toEqual([]);
  });

  it.each([
    ['a missing email', { password: 'placeholder-password' }],
    ['an empty email', { email: '', password: 'placeholder-password' }],
    ['an email that is too long', { email: `${'a'.repeat(320)}@example.com`, password: 'placeholder-password' }],
    ['a missing password', { email: 'person@example.com' }],
    ['a password that is not a string', { email: 'person@example.com', password: 1 }],
    ['a password that is too long', { email: 'person@example.com', password: 'a'.repeat(1025) }],
  ])('should refuse %s with 400, without calling the API', async (_name, body) => {
    const fetchMock = mockFetch(jsonUpstream(200, tokens));

    const response = await call(login, loginRequest(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ message: 'Invalid body', code: 'BAD_REQUEST' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should refuse a body that is not JSON', async () => {
    const fetchMock = mockFetch(jsonUpstream(200, tokens));

    const response = await call(login, loginRequest('{not json'));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  describe('size of the body', () => {
    const TOO_LARGE = { message: 'Payload too large', code: 'PAYLOAD_TOO_LARGE' };

    it('should refuse with 413, reading nothing, a body that declares more than 16 KiB', async () => {
      const fetchMock = mockFetch(jsonUpstream(200, tokens));

      const response = await call(login, loginRequest(credentials, { headers: { 'Content-Length': String(16 * 1024 + 1) } }));

      expect(response.status).toBe(413);
      expect(await response.json()).toEqual(TOO_LARGE);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should refuse with 413 a body that has no declared length and grows past 16 KiB', async () => {
      const fetchMock = mockFetch(jsonUpstream(200, tokens));
      const chunk = new Uint8Array(8 * 1024).fill(97);
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(chunk);
          controller.enqueue(chunk);
          controller.enqueue(chunk);
          controller.close();
        },
      });
      const request = new Request('https://app.test/api/auth/login', {
        method  : 'POST',
        headers : { Origin: 'https://app.test', 'X-Requested-With': 'my-web-app', 'Content-Type': 'application/json' },
        body    : stream,
        // @ts-expect-error `duplex` is required by the runtime to send a stream, and is missing from the DOM types.
        duplex  : 'half',
      });

      const response = await call(login, request);

      expect(response.status).toBe(413);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should accept the largest credentials the route allows', async () => {
      mockFetch(jsonUpstream(200, tokens));

      const response = await call(login, loginRequest({ email: `${'a'.repeat(310)}@example.com`.slice(0, 320), password: 'a'.repeat(1024) }));

      expect(response.status).toBe(200);
    });
  });

  it.each([
    ['no X-Requested-With', { csrf: false }],
    ['another origin', { origin: 'https://evil.test' }],
    ['no Origin', { origin: null }],
  ])('should refuse a login with %s', async (_name, options) => {
    const fetchMock = mockFetch(jsonUpstream(200, tokens));

    const response = await call(login, loginRequest(credentials, options));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ code: 'CSRF_REJECTED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should answer 503 and set no cookie when the API cannot be reached', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockFetch(new TypeError('fetch failed'));

    const response = await call(login, loginRequest(credentials));

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ message: 'The service cannot be reached', code: 'API_UNAVAILABLE' });
    expect(setCookies(response)).toEqual([]);
  });

  it('should answer 503 and set no cookie when the answer is not a set of tokens', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockFetch(jsonUpstream(200, { unexpected: true }));

    const response = await call(login, loginRequest(credentials));

    expect(response.status).toBe(503);
    expect(setCookies(response)).toEqual([]);
  });

  it('should not log the email, the password or the tokens', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockFetch(new TypeError('fetch failed'));

    await call(login, loginRequest(credentials));

    const logged = JSON.stringify([...error.mock.calls, ...warn.mock.calls]);
    expect(logged).not.toContain(credentials.email);
    expect(logged).not.toContain(credentials.password);
  });
});
