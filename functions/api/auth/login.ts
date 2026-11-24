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

  const credentials = await readCredentials(request);
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

async function readCredentials(request: Request): Promise<{ email: string; password: string } | null> {
  try {
    const body = await request.json() as { email?: unknown; password?: unknown };

    if (
      typeof body.email === 'string' && body.email.length >= 1 && body.email.length <= MAX_EMAIL_LENGTH &&
      typeof body.password === 'string' && body.password.length >= 1 && body.password.length <= MAX_PASSWORD_LENGTH
    ) {
      return { email: body.email, password: body.password };
    }
  } catch {
    // Not JSON.
  }

  return null;
}
