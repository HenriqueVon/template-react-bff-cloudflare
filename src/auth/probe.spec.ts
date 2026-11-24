import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { probeSession } from './probe';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const user = { id: 'user-1', name: 'Example Person', email: 'person@example.com' };

describe('probeSession', () => {
  let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

  beforeEach(() => {
    fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should ask the API who is signed in', async () => {
    fetchMock.mockResolvedValue(json(200, user));

    await probeSession();

    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/me');
  });

  it('should report the session and the user when the call works', async () => {
    fetchMock.mockResolvedValue(json(200, user));

    await expect(probeSession()).resolves.toEqual({ status: 'authenticated', user });
  });

  it('should report no session when there is none, after trying to refresh', async () => {
    fetchMock.mockImplementation(async (url) => (
      url === '/api/auth/refresh' ? json(401, { code: 'AUTH_SESSION_MISSING' }) : json(401, { code: 'AUTH_TOKEN_EXPIRED' })
    ));

    await expect(probeSession()).resolves.toEqual({ status: 'anonymous' });
  });

  it('should report no access on 403', async () => {
    fetchMock.mockResolvedValue(json(403, { message: 'Forbidden', code: 'FORBIDDEN' }));

    await expect(probeSession()).resolves.toEqual({ status: 'forbidden', code: 'FORBIDDEN' });
  });

  it.each([
    [503, 'API_UNAVAILABLE'],
    [429, 'RATE_LIMITED'],
    [500, undefined],
  ])('should report a temporary failure on %s, not a missing session', async (status, code) => {
    fetchMock.mockResolvedValue(json(status, { message: 'Failed', code }));

    await expect(probeSession()).resolves.toMatchObject({ status: 'unavailable' });
  });

  it('should report a temporary failure when the server cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));

    await expect(probeSession()).resolves.toMatchObject({ status: 'unavailable' });
  });
});
