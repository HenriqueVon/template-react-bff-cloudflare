import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  apiRequest,
  ApiError,
  // @template:login-google:start
  exchangeCode,
  // @template:login-google:end
  logout,
  logoutAll,
  // @template:login-password:start
  login,
  // @template:login-password:end
  refreshSession,
  setSessionExpiredHandler,
} from './client';

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

const expired = () => json(401, { message: 'Token expired', code: 'AUTH_TOKEN_EXPIRED' });

describe('apiRequest', () => {
  let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;
  let expiredHandler: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
    vi.stubGlobal('fetch', fetchMock);
    expiredHandler = vi.fn<() => void>();
    setSessionExpiredHandler(expiredHandler);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setSessionExpiredHandler(null);
  });

  function calls(path: string) {
    return fetchMock.mock.calls.filter(([url]) => String(url).startsWith(path));
  }

  it('should call /api with the CSRF header and the query, and parse the JSON', async () => {
    fetchMock.mockResolvedValue(json(200, { items: [], total: 0 }));

    await expect(apiRequest('/things', { query: { limit: 20, offset: 0, search: undefined, name: '' } })).resolves.toEqual({ items: [], total: 0 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/things?limit=20&offset=0');
    expect((init?.headers as Record<string, string>)['X-Requested-With']).toBe('my-web-app');
    expect(init?.credentials).toBe('same-origin');
  });

  it('should repeat the parameter of an array in the query', async () => {
    fetchMock.mockResolvedValue(json(200, {}));

    await apiRequest('/things', { query: { type: ['INCOME', 'EXPENSE'] } });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/things?type=INCOME&type=EXPENSE');
  });

  it('should send a JSON body with the method', async () => {
    fetchMock.mockResolvedValue(json(201, { id: 'new' }));

    await apiRequest('/things', { method: 'POST', body: { name: 'First example' } });

    const [, init] = fetchMock.mock.calls[0];
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"name":"First example"}');
    expect((init?.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('should return undefined for a 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(apiRequest('/things/abc', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  describe('expired access token', () => {
    it('should refresh once and retry when the token expired', async () => {
      fetchMock.mockImplementation(async (url) => {
        if (url === '/api/auth/refresh') return json(200, { expiresIn: 900 });
        return fetchMock.mock.calls.filter(([called]) => called === '/api/things').length === 1 ? expired() : json(200, { items: [], total: 0 });
      });

      await expect(apiRequest('/things')).resolves.toEqual({ items: [], total: 0 });

      expect(calls('/api/auth/refresh')).toHaveLength(1);
      expect(calls('/api/things')).toHaveLength(2);
      expect(expiredHandler).not.toHaveBeenCalled();
    });

    it('should refresh once for many requests that got 401 at the same time, then retry each', async () => {
      let refreshes = 0;
      const seen = new Set<string>();
      fetchMock.mockImplementation(async (url) => {
        if (url === '/api/auth/refresh') {
          refreshes += 1;
          await new Promise((resolve) => setTimeout(resolve, 10));
          return json(200, { expiresIn: 900 });
        }
        const first = !seen.has(url);
        seen.add(url);
        return first ? expired() : json(200, { ok: true });
      });

      await Promise.all([apiRequest('/things'), apiRequest('/others'), apiRequest('/more')]);

      expect(refreshes).toBe(1);
    });

    it('should end the session when the refresh says there is no session (401)', async () => {
      fetchMock.mockImplementation(async (url) => (url === '/api/auth/refresh' ? json(401, { code: 'AUTH_SESSION_MISSING' }) : expired()));

      await expect(apiRequest('/things')).rejects.toMatchObject({ status: 401, code: 'AUTH_TOKEN_EXPIRED' });

      expect(expiredHandler).toHaveBeenCalledTimes(1);
      expect(calls('/api/things')).toHaveLength(1);
    });

    it('should end the session when the refresh says the access is gone (403)', async () => {
      fetchMock.mockImplementation(async (url) => (url === '/api/auth/refresh' ? json(403, { code: 'FORBIDDEN' }) : expired()));

      await expect(apiRequest('/things')).rejects.toBeInstanceOf(ApiError);

      expect(expiredHandler).toHaveBeenCalledTimes(1);
    });

    it.each([
      [503, 'API_UNAVAILABLE'],
      [429, 'RATE_LIMITED'],
    ])('should NOT end the session when the refresh fails temporarily (%s)', async (status, code) => {
      fetchMock.mockImplementation(async (url) => (url === '/api/auth/refresh' ? json(status, { code }, status === 429 ? { 'Retry-After': '30' } : {}) : expired()));

      await expect(apiRequest('/things')).rejects.toMatchObject({ status, code });

      expect(expiredHandler).not.toHaveBeenCalled();
    });

    it('should NOT end the session when the refresh cannot reach the server', async () => {
      fetchMock.mockImplementation(async (url) => {
        if (url === '/api/auth/refresh') throw new TypeError('fetch failed');
        return expired();
      });

      await expect(apiRequest('/things')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });

      expect(expiredHandler).not.toHaveBeenCalled();
    });

    it('should end the session when the retry is still 401', async () => {
      fetchMock.mockImplementation(async (url) => (url === '/api/auth/refresh' ? json(200, {}) : expired()));

      await expect(apiRequest('/things')).rejects.toMatchObject({ status: 401 });

      expect(expiredHandler).toHaveBeenCalledTimes(1);
      expect(calls('/api/auth/refresh')).toHaveLength(1);
    });
  });

  describe('other 401s', () => {
    it.each(['AUTH_TOKEN_INVALID', 'AUTH_SESSION_REVOKED', 'AUTH_SESSION_MISSING'])(
      'should end the session without refreshing on %s',
      async (code) => {
        fetchMock.mockResolvedValue(json(401, { message: 'Session over', code }));

        await expect(apiRequest('/things')).rejects.toMatchObject({ status: 401, code });

        expect(expiredHandler).toHaveBeenCalledTimes(1);
        expect(calls('/api/auth/refresh')).toHaveLength(0);
      },
    );
  });

  describe('errors', () => {
    it('should turn an error body into an ApiError with the code, the wait and the issues', async () => {
      fetchMock.mockResolvedValue(json(400, {
        message : 'Invalid body',
        issues  : [{ path: 'name', message: 'Name must have at least 3 characters', code: 'too_small' }],
      }));

      await expect(apiRequest('/things', { method: 'POST', body: {} })).rejects.toMatchObject({
        status : 400,
        issues : [{ path: 'name', message: 'Name must have at least 3 characters', code: 'too_small' }],
      });
    });

    it('should keep Retry-After of a 429', async () => {
      fetchMock.mockResolvedValue(json(429, { message: 'Too many', code: 'RATE_LIMITED' }, { 'Retry-After': '45' }));

      await expect(apiRequest('/things')).rejects.toMatchObject({ status: 429, retryAfter: 45 });
    });

    it('should not end the session on a 403, a 409 or a 503', async () => {
      for (const status of [403, 409, 503]) {
        fetchMock.mockResolvedValue(json(status, { message: 'Refused', code: 'X' }));
        await expect(apiRequest('/things')).rejects.toMatchObject({ status });
      }

      expect(expiredHandler).not.toHaveBeenCalled();
    });

    it('should turn a failed fetch into a network ApiError', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));

      await expect(apiRequest('/things')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
    });

    it('should handle an error page that is not JSON', async () => {
      fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502, statusText: 'Bad Gateway' }));

      await expect(apiRequest('/things')).rejects.toMatchObject({ status: 502, message: 'Bad Gateway' });
    });
  });
});

describe('login and logout calls', () => {
  let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

  beforeEach(() => {
    fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // @template:login-password:start
  it('should post the credentials to the login, with the CSRF header', async () => {
    fetchMock.mockResolvedValue(json(200, { expiresIn: 900 }));

    await login('person@example.com', 'placeholder-password');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/login');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ email: 'person@example.com', password: 'placeholder-password' });
    expect((init?.headers as Record<string, string>)['X-Requested-With']).toBe('my-web-app');
  });

  it('should throw the ApiError of a refused login, so the page can say why', async () => {
    fetchMock.mockResolvedValue(json(401, { message: 'Invalid email or password', code: 'AUTH_INVALID_CREDENTIALS' }));

    await expect(login('person@example.com', 'wrong')).rejects.toMatchObject({ status: 401, code: 'AUTH_INVALID_CREDENTIALS' });
  });
  // @template:login-password:end

  // @template:login-google:start
  it('should post the code and the state to the exchange, with the CSRF header and no verifier', async () => {
    fetchMock.mockResolvedValue(json(200, { expiresIn: 900 }));

    await exchangeCode('placeholder-code', 'placeholder-state');

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/auth/exchange');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ code: 'placeholder-code', state: 'placeholder-state' });
    expect((init?.headers as Record<string, string>)['X-Requested-With']).toBe('my-web-app');
  });

  it('should throw the ApiError of a refused exchange', async () => {
    fetchMock.mockResolvedValue(json(401, { message: 'Invalid code', code: 'AUTH_CODE_INVALID' }));

    await expect(exchangeCode('placeholder-code', 'placeholder-state')).rejects.toMatchObject({ status: 401, code: 'AUTH_CODE_INVALID' });
  });
  // @template:login-google:end

  it('should resolve when the Function answers 204 to the logout', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(logout()).resolves.toBeUndefined();

    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/logout');
  });

  it('should throw when the logout does not reach the Function: the cookies are still there', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(logout()).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });

  it('should throw on a gateway error of the logout', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }));

    await expect(logout()).rejects.toMatchObject({ status: 502 });
  });

  it('should throw when logout from all devices fails', async () => {
    fetchMock.mockResolvedValue(json(503, { message: 'Unavailable', code: 'API_UNAVAILABLE' }));

    await expect(logoutAll()).rejects.toMatchObject({ status: 503, code: 'API_UNAVAILABLE' });
  });

  it('should resolve when logout from all devices answers 204', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(logoutAll()).resolves.toBeUndefined();
  });

  describe('with the Web Locks API', () => {
    // An exclusive lock: one holder at a time, in the order of the requests.
    function stubLocks() {
      let tail: Promise<unknown> = Promise.resolve();
      const request = vi.fn((_name: string, run: () => Promise<unknown>) => {
        const result = tail.then(run);
        tail = result.catch(() => undefined);
        return result;
      });
      vi.stubGlobal('navigator', { locks: { request } });

      return request;
    }

    // A refresh that does not answer until the test says so, and a logout that answers at once.
    function slowRefresh() {
      let answer!: () => void;
      fetchMock.mockImplementation((url) => {
        if (url === '/api/auth/refresh') {
          return new Promise<Response>((resolve) => { answer = () => resolve(new Response(null, { status: 204 })); });
        }
        return Promise.resolve(new Response(null, { status: 204 }));
      });

      return () => answer();
    }

    const sent = () => fetchMock.mock.calls.map(([url]) => url);

    it.each([
      ['logout', logout, '/api/auth/logout'],
      ['logout from all devices', logoutAll, '/api/auth/logout-all'],
    ])('should make the %s wait for a refresh in progress, so its answer cannot set cookies after the logout cleared them', async (_name, leave, path) => {
      stubLocks();
      const answerRefresh = slowRefresh();

      const refreshing = refreshSession();
      const leaving = leave();
      await vi.waitFor(() => expect(sent()).toEqual(['/api/auth/refresh']));
      await Promise.resolve();
      expect(sent()).toEqual(['/api/auth/refresh']);

      answerRefresh();
      await expect(refreshing).resolves.toEqual({ status: 'renewed' });
      await expect(leaving).resolves.toBeUndefined();

      expect(sent()).toEqual(['/api/auth/refresh', path]);
    });

    it('should hold the lock named after the project for a logout, the same one the refresh takes', async () => {
      const request = stubLocks();
      fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

      await logout();
      await refreshSession();

      expect(request.mock.calls.map(([name]) => name)).toEqual(['my-web-app-refresh', 'my-web-app-refresh']);
    });
  });
});
