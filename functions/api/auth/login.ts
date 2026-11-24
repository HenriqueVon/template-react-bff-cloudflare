import { PAYLOAD_TOO_LARGE, readJsonWithLimit } from '../../../server/body';
import { callApi, jsonResponse, type Env } from '../../../server/upstream';
import { refuseCrossSite } from '../../../server/security';
import { failedSessionResponse, sessionResponse } from '../../../server/session';

const MAX_EMAIL_LENGTH = 320;
const MAX_PASSWORD_LENGTH = 1024;

// POST /api/auth/login { email, password }: signs the user in with the API. The tokens come back as session cookies
// and the body carries no token.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const refused = refuseCrossSite(request);
  if (refused) return refused;

  // Anyone can reach this route, so the body is bounded before it is parsed.
  const body = await readJsonWithLimit(request);
  if (!body.ok && body.reason === 'too-large') {
    return jsonResponse(413, PAYLOAD_TOO_LARGE);
  }

  const credentials = body.ok ? validCredentials(body.value) : null;
  if (!credentials) {
    return jsonResponse(400, { message: 'Invalid body', code: 'BAD_REQUEST' });
  }

  // The credentials are forwarded as they are and never logged; the API validates them.
  const upstream = await callApi(env, '/auth/login', {
    method  : 'POST',
    headers : { 'Content-Type': 'application/json' },
    body    : JSON.stringify(credentials),
  }, request);

  // A wrong password must not clear cookies of an older session in this browser: only a refresh does that.
  if (!upstream.ok) return failedSessionResponse(upstream, false);

  return sessionResponse(upstream);
};

function validCredentials(value: unknown): { email: string; password: string } | null {
  if (typeof value !== 'object' || value === null) return null;

  const { email, password } = value as { email?: unknown; password?: unknown };

  if (
    typeof email === 'string' && email.length >= 1 && email.length <= MAX_EMAIL_LENGTH &&
    typeof password === 'string' && password.length >= 1 && password.length <= MAX_PASSWORD_LENGTH
  ) {
    return { email, password };
  }

  return null;
}
