// HTTP client of the app. The browser only talks to /api on its own origin; the Pages Functions add the API key and the
// access token from HttpOnly cookies, so no token is ever visible here.

// `npm run init` sets this value to the name of the project; server/security.ts checks the same one.
const CSRF_HEADERS = { 'X-Requested-With': 'my-web-app' };

export type ValidationIssue = { path: string; message: string; code: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code?: string;
  // Seconds to wait, from Retry-After (429).
  readonly retryAfter?: number;
  readonly issues: ValidationIssue[];

  constructor(status: number, message: string, code?: string, retryAfter?: number, issues: ValidationIssue[] = []) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfter = retryAfter;
    this.issues = issues;
  }
}

// An array repeats the parameter (?name=A&name=B).
type Query = Record<string, string | number | boolean | string[] | undefined>;

type RequestOptions = {
  method? : 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?   : unknown;
  query?  : Query;
};

let onSessionExpired: (() => void) | null = null;

// Set by AuthProvider: called when the session cannot be renewed, to send the user to the login.
export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (Array.isArray(value)) {
      for (const item of value) params.append(key, item);
    } else if (value !== undefined && value !== '') {
      params.set(key, String(value));
    }
  }

  const search = params.toString();
  return `/api${path}${search ? `?${search}` : ''}`;
}

async function send(url: string, options: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { ...CSRF_HEADERS, Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';

  try {
    return await fetch(url, {
      method      : options.method ?? 'GET',
      headers,
      body        : options.body === undefined ? undefined : JSON.stringify(options.body),
      credentials : 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'Network error', 'NETWORK_ERROR');
  }
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: { message?: string; code?: string; issues?: ValidationIssue[] } = {};
  try {
    body = await response.json();
  } catch {
    // Not JSON, for example a gateway error page.
  }

  const retryAfterHeader = response.headers.get('Retry-After');
  const retryAfter = retryAfterHeader && /^\d+$/.test(retryAfterHeader) ? Number(retryAfterHeader) : undefined;

  return new ApiError(response.status, body.message ?? response.statusText, body.code, retryAfter, body.issues ?? []);
}

// How a refresh ended: the cookies were renewed; the session is over (no session, revoked, or no access any more); or
// the refresh itself failed for a temporary reason, which is not a session problem.
type RefreshResult =
  | { status: 'renewed' }
  | { status: 'ended' }
  | { status: 'failed'; error: ApiError };

let refreshInFlight: Promise<RefreshResult> | null = null;

// An API that rotates refresh tokens ends the whole session when a replaced one is used again, so two refreshes must
// never run at the same time. Inside a tab the promise is shared; across tabs the Web Locks API makes them wait for
// each other, and the second one sends the new cookie.
export function refreshSession(): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight;

  const run = async (): Promise<RefreshResult> => {
    try {
      const response = await send('/api/auth/refresh', { method: 'POST' });
      if (response.ok) return { status: 'renewed' };
      if (response.status === 401 || response.status === 403) return { status: 'ended' };

      return { status: 'failed', error: await toApiError(response) };
    } catch (error) {
      return { status: 'failed', error: error instanceof ApiError ? error : new ApiError(0, 'Network error', 'NETWORK_ERROR') };
    }
  };

  // The DOM types return Promise<Promise<T>> for request(); at runtime the inner promise is awaited.
  const locked = (typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('my-web-app-refresh', run)
    : run()) as Promise<RefreshResult>;

  const inFlight = locked.finally(() => {
    refreshInFlight = null;
  });
  refreshInFlight = inFlight;

  return inFlight;
}

async function codeOf(response: Response): Promise<string | undefined> {
  try {
    const body = await response.clone().json() as { code?: unknown };
    return typeof body.code === 'string' ? body.code : undefined;
  } catch {
    return undefined;
  }
}

// Calls an API route through the proxy. Only an expired access token (401 AUTH_TOKEN_EXPIRED) renews the session,
// once, and retries. Any other 401 means the session is over. A temporary failure (429, 503, network) is thrown as it
// is and never ends the session.
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const url = buildUrl(path, options.query);

  let response = await send(url, options);

  if (response.status === 401) {
    if (await codeOf(response) === 'AUTH_TOKEN_EXPIRED') {
      const refreshed = await refreshSession();

      if (refreshed.status === 'failed') throw refreshed.error;
      if (refreshed.status === 'renewed') response = await send(url, options);
    }

    if (response.status === 401) {
      onSessionExpired?.();
    }
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

// @template:login-password:start
// Signs in with an email and a password. The Function sets the session cookies; the body has no token. A failure is
// thrown with the code of the API (wrong credentials, too many attempts) and nothing is stored.
export async function login(email: string, password: string): Promise<void> {
  const response = await send('/api/auth/login', { method: 'POST', body: { email, password } });
  if (!response.ok) throw await toApiError(response);
}
// @template:login-password:end

// @template:login-google:start
// The last step of the Google login: the page /auth/callback sends the code and the state it received. The Function
// keeps the verifier in a cookie, so the browser never holds it.
export async function exchangeCode(code: string, state: string): Promise<void> {
  const response = await send('/api/auth/exchange', { method: 'POST', body: { code, state } });
  if (!response.ok) throw await toApiError(response);
}
// @template:login-google:end

// Logout goes to its own function, without the refresh-and-retry above. The Function always answers 204 and clears the
// cookies, even if the API could not be told. So a failure here means the request never reached the Function (no
// connection, a gateway error): the cookies are still in the browser, and JavaScript cannot clear them. It is thrown, so
// the app says so instead of showing a login page that a reload would bypass.
export async function logout(): Promise<void> {
  const response = await send('/api/auth/logout', { method: 'POST' });
  if (!response.ok) throw await toApiError(response);
}

// Unlike logout, a failure is thrown: the other sessions are still open, so the app must say so.
export async function logoutAll(): Promise<void> {
  const response = await send('/api/auth/logout-all', { method: 'POST' });
  if (!response.ok) throw await toApiError(response);
}
