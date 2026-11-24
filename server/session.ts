import { jsonResponse, passThrough, unavailable, type TokenResponse } from './upstream';
import { clearTokenCookies, setTokenCookies } from './cookies';

// Answers a successful login or refresh: the tokens go into cookies, and the body has only the access token
// lifetime, so the browser never sees a token. headers may carry other cookies to set or clear.
export function tokenResponse(tokens: TokenResponse, headers = new Headers()): Response {
  setTokenCookies(headers, tokens);

  return jsonResponse(200, { expiresIn: tokens.expiresIn }, headers);
}

// Reads the tokens of a successful answer of the API. An answer that does not look like tokens is a failure of the
// service, not of the user.
export async function readTokens(upstream: Response): Promise<TokenResponse | null> {
  try {
    const body = await upstream.json() as Partial<TokenResponse>;

    if (
      typeof body.accessToken === 'string' && body.accessToken !== '' &&
      typeof body.refreshToken === 'string' && body.refreshToken !== '' &&
      typeof body.expiresIn === 'number' && body.expiresIn > 0
    ) {
      return { accessToken: body.accessToken, refreshToken: body.refreshToken, expiresIn: body.expiresIn, tokenType: body.tokenType ?? 'Bearer' };
    }
  } catch {
    // Not JSON.
  }

  console.error({ event: 'API_BAD_RESPONSE', status: upstream.status });
  return null;
}

// Same as tokenResponse for a successful upstream answer; 503 if the answer is not usable.
export async function sessionResponse(upstream: Response, headers = new Headers()): Promise<Response> {
  const tokens = await readTokens(upstream);
  if (!tokens) return withHeaders(unavailable(), headers);

  return tokenResponse(tokens, headers);
}

// Answers a refused login or refresh, clearing the cookies of a session that no longer works.
export function failedSessionResponse(upstream: Response, clearCookies: boolean, headers = new Headers()): Response {
  if (clearCookies) clearTokenCookies(headers);

  return passThrough(upstream, headers);
}

// Adds cookies to a response that was built without them.
function withHeaders(response: Response, headers: Headers): Response {
  for (const cookie of headers.getSetCookie()) response.headers.append('Set-Cookie', cookie);

  return response;
}
