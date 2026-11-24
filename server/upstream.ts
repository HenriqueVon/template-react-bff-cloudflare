// Configuration of the Pages Functions. It comes from .dev.vars locally and from the Cloudflare Pages project in
// deployment; it never reaches the browser. This repository may be public: no value is written in the code.
export interface Env {
  // Base URL of the API, including its version path (for example https://api.example.com/v1/api).
  API_URL: string;
  // x-api-key of the API. A secret.
  API_KEY: string;
  // @template:login-google:start
  // Base URL of the service that signs the user in with Google, without the version path. The browser is
  // redirected there to start the login.
  AUTH_PUBLIC_URL: string;
  // Public client id of this app at that service.
  AUTH_CLIENT_ID: string;
  // @template:login-google:end
}

export type TokenResponse = {
  accessToken  : string;
  tokenType    : string;
  expiresIn    : number;
  refreshToken : string;
};

// A call to the API that takes longer than this fails with 503, before the Function does.
const UPSTREAM_TIMEOUT_MS = 10_000;

export function jsonResponse(status: number, body: unknown, headers?: HeadersInit): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
  responseHeaders.set('Cache-Control', 'no-store');

  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

// A missing variable is a deployment mistake, not a user error. It is logged by name, never by value.
export function misconfigured(names: string[]): Response {
  console.error({ event: 'BFF_MISCONFIGURED', variables: names });

  return jsonResponse(500, { message: 'The server is not configured', code: 'BFF_MISCONFIGURED' });
}

export function unavailable(): Response {
  return jsonResponse(503, { message: 'The service cannot be reached', code: 'API_UNAVAILABLE' });
}

// Calls the API with its key, for the user of browserRequest. A network failure or a timeout becomes a 503, so the
// browser gets the same error shape as from the API and does not mistake it for a session problem.
export async function callApi(env: Env, path: string, init: RequestInit, browserRequest: Request): Promise<Response> {
  const missing = (['API_URL', 'API_KEY'] as const).filter((name) => !env[name]);
  if (missing.length > 0) return misconfigured(missing);

  const headers = new Headers(init.headers);
  headers.set('x-api-key', env.API_KEY);
  headers.set('Accept', 'application/json');
  setEndUserHeaders(headers, browserRequest);

  const baseUrl = env.API_URL.replace(/\/+$/, '');

  try {
    return await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      redirect : 'manual',
      signal   : AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    // The message says why (DNS, refused, TLS, timeout) and carries no header or body values.
    console.error({ event: 'API_UNREACHABLE', path, error: error instanceof Error ? error.message : String(error) });
    return unavailable();
  }
}

// The device of the user, which the API can store on the session and in its audit log. Cloudflare sets
// CF-Connecting-IP at its edge and replaces any value the browser sends, so the browser cannot choose the IP.
// Never X-Forwarded-For, which the browser can write.
function setEndUserHeaders(headers: Headers, browserRequest: Request): void {
  const ip = browserRequest.headers.get('CF-Connecting-IP');
  if (ip) headers.set('X-End-User-IP', ip);

  const userAgent = browserRequest.headers.get('User-Agent');
  if (userAgent) headers.set('X-End-User-Agent', userAgent);
}

// Returns the API response to the browser with only the headers it needs.
export function passThrough(upstream: Response, headers?: Headers): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Cache-Control', 'no-store');

  const contentType = upstream.headers.get('Content-Type');
  if (contentType) responseHeaders.set('Content-Type', contentType);

  const retryAfter = upstream.headers.get('Retry-After');
  if (retryAfter) responseHeaders.set('Retry-After', retryAfter);

  const body = upstream.status === 204 ? null : upstream.body;

  return new Response(body, { status: upstream.status, headers: responseHeaders });
}
