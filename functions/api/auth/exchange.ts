import { PAYLOAD_TOO_LARGE, readJsonWithLimit } from '../../../server/body';
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

  // Anyone can reach this route, so the body is bounded before it is parsed.
  const parsed = await readJsonWithLimit(request);
  if (!parsed.ok && parsed.reason === 'too-large') {
    return jsonResponse(413, PAYLOAD_TOO_LARGE, headers);
  }

  const body = parsed.ok ? validBody(parsed.value) : null;
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

function validBody(value: unknown): { code: string; state: string } | null {
  if (typeof value !== 'object' || value === null) return null;

  const { code, state } = value as { code?: unknown; state?: unknown };

  if (
    typeof code === 'string' && code.length >= 1 && code.length <= 256 &&
    typeof state === 'string' && state.length >= 1 && state.length <= 512
  ) {
    return { code, state };
  }

  return null;
}
