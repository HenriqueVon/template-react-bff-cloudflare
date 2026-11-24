import { vi } from 'vitest';
import type { Env } from '../../server/upstream';

// Placeholders only: this repository is public (docs/SECURITY.md).
export const env: Env = {
  API_URL : 'https://api.test/v1/api/',
  API_KEY : 'placeholder-api-key',
  // @template:login-google:start
  AUTH_PUBLIC_URL : 'https://auth-api.test/',
  AUTH_CLIENT_ID  : 'placeholder-client-id',
  // @template:login-google:end
};

export const ORIGIN = 'https://app.test';

export const tokens = {
  accessToken  : 'placeholder.access.token',
  tokenType    : 'Bearer',
  expiresIn    : 900,
  refreshToken : 'session-1.placeholder-secret',
};

type RequestOptions = {
  method?  : string;
  body?    : string;
  cookie?  : string;
  origin?  : string | null;
  csrf?    : boolean;
  headers? : Record<string, string>;
};

export function buildRequest(path: string, options: RequestOptions = {}): Request {
  const headers = new Headers(options.headers);
  if (options.cookie) headers.set('Cookie', options.cookie);
  if (options.origin !== null) headers.set('Origin', options.origin ?? ORIGIN);
  if (options.csrf !== false) headers.set('X-Requested-With', 'my-web-app');
  if (options.body) headers.set('Content-Type', 'application/json');

  return new Request(`${ORIGIN}${path}`, { method: options.method ?? 'POST', headers, body: options.body });
}

// Calls a Pages Function handler with the parts of the context it uses.
export function call(
  handler: (context: never) => Response | Promise<Response>,
  request: Request,
  params: Record<string, string | string[]> = {},
  environment: Partial<Env> = env,
): Promise<Response> {
  return Promise.resolve(handler({ request, env: environment, params } as never));
}

export function mockFetch(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

export function jsonUpstream(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

export function setCookies(response: Response): string[] {
  return response.headers.getSetCookie();
}

// The request the function sent to the API.
export function upstreamCall(fetchMock: ReturnType<typeof mockFetch>, index = 0) {
  const [url, init] = fetchMock.mock.calls[index] as unknown as [string, RequestInit];
  return { url, init, headers: new Headers(init.headers) };
}

// The value of a cookie in a list of Set-Cookie headers.
export function cookieValue(cookies: string[], name: string): string | null {
  const cookie = cookies.find((entry) => entry.startsWith(`${name}=`));
  if (!cookie) return null;

  return cookie.slice(name.length + 1).split(';')[0];
}
