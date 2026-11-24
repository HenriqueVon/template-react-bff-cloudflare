import { callApi, jsonResponse, type Env } from '../../../server/upstream';
import { clearPkceCookie, readPkceCookie } from '../../../server/cookies';
import { redirectUriOf } from '../../../server/login';
import { safeEqual } from '../../../server/pkce';
import { refuseCrossSite } from '../../../server/security';
import { failedSessionResponse, sessionResponse } from '../../../server/session';

const INVALID_STATE = { message: 'The login is invalid or expired', code: 'LOGIN_STATE_INVALID' };

// POST /api/auth/exchange { code, state }: the last step of the Google login. The /auth/callback page sends the code
// and the state it received. The state is compared with the one in the PKCE cookie before anything else; then the
// code goes to the API with the verifier of the cookie, and the tokens come back as session cookies. The PKCE cookie
// is deleted on every outcome: a login is started again, never retried.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const refused = refuseCrossSite(request);
  if (refused) return refused;

  const headers = new Headers();
  clearPkceCookie(headers);

  const body = await readBody(request);
  if (!body) {
    return jsonResponse(400, { message: 'Invalid body', code: 'BAD_REQUEST' }, headers);
  }

  const pkce = readPkceCookie(request);
  if (!pkce || !safeEqual(pkce.state, body.state)) {
    return jsonResponse(400, INVALID_STATE, headers);
  }

  const upstream = await callApi(env, '/auth/exchange-code', {
    method  : 'POST',
    headers : { 'Content-Type': 'application/json' },
    body    : JSON.stringify({ code: body.code, codeVerifier: pkce.verifier, redirectUri: redirectUriOf(request) }),
  }, request);

  if (!upstream.ok) return failedSessionResponse(upstream, false, headers);

  return sessionResponse(upstream, headers);
};

async function readBody(request: Request): Promise<{ code: string; state: string } | null> {
  try {
    const body = await request.json() as { code?: unknown; state?: unknown };

    if (
      typeof body.code === 'string' && body.code.length >= 1 && body.code.length <= 256 &&
      typeof body.state === 'string' && body.state.length >= 1 && body.state.length <= 512
    ) {
      return { code: body.code, state: body.state };
    }
  } catch {
    // Not JSON.
  }

  return null;
}
