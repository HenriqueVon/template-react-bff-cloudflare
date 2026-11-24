// __Host- cookies must be Secure, have Path=/ and no Domain, so a subdomain cannot set or overwrite them. HttpOnly
// keeps them away from JavaScript.
export const ACCESS_COOKIE = '__Host-app_at';
export const REFRESH_COOKIE = '__Host-app_rt';
// @template:login-google:start
// The PKCE verifier and the state of a login in progress. It lives for the length of a login.
export const PKCE_COOKIE = '__Host-app_pkce';
// @template:login-google:end

// The API does not return the refresh token lifetime and enforces it itself. The cookie lasts 30 days and is
// replaced on every refresh. Match the refresh token lifetime of your API.
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
// @template:login-google:start
const PKCE_COOKIE_MAX_AGE = 10 * 60;
// @template:login-google:end

// The session cookies are Strict: they stay off every cross-site request.
// @template:login-google:start
// The PKCE cookie is Lax, because the return from Google is a cross-site navigation that must carry it.
// @template:login-google:end
type SameSite = 'Strict' | 'Lax';

function serialize(name: string, value: string, maxAge: number, sameSite: SameSite): string {
  return `${name}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=${sameSite}`;
}

type Tokens = { accessToken: string; refreshToken: string; expiresIn: number };

export function setTokenCookies(headers: Headers, tokens: Tokens): void {
  headers.append('Set-Cookie', serialize(ACCESS_COOKIE, tokens.accessToken, tokens.expiresIn, 'Strict'));
  headers.append('Set-Cookie', serialize(REFRESH_COOKIE, tokens.refreshToken, REFRESH_COOKIE_MAX_AGE, 'Strict'));
}

export function clearTokenCookies(headers: Headers): void {
  headers.append('Set-Cookie', serialize(ACCESS_COOKIE, '', 0, 'Strict'));
  headers.append('Set-Cookie', serialize(REFRESH_COOKIE, '', 0, 'Strict'));
}

// @template:login-google:start
// verifier and state are base64url, so the dot cannot appear inside either one.
const PKCE_VERIFIER = /^[A-Za-z0-9_-]{43,128}$/;
const PKCE_STATE = /^[A-Za-z0-9_-]{16,128}$/;

export function setPkceCookie(headers: Headers, verifier: string, state: string): void {
  headers.append('Set-Cookie', serialize(PKCE_COOKIE, `${verifier}.${state}`, PKCE_COOKIE_MAX_AGE, 'Lax'));
}

export function clearPkceCookie(headers: Headers): void {
  headers.append('Set-Cookie', serialize(PKCE_COOKIE, '', 0, 'Lax'));
}

export function readPkceCookie(request: Request): { verifier: string; state: string } | null {
  const value = readCookie(request, PKCE_COOKIE);
  if (!value) return null;

  const parts = value.split('.');
  if (parts.length !== 2) return null;

  const [verifier, state] = parts;
  if (!PKCE_VERIFIER.test(verifier) || !PKCE_STATE.test(state)) return null;

  return { verifier, state };
}
// @template:login-google:end

export function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get('Cookie');
  if (!header) return null;

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;

    if (part.slice(0, separator).trim() === name) {
      const value = part.slice(separator + 1).trim();
      return value === '' ? null : value;
    }
  }

  return null;
}
