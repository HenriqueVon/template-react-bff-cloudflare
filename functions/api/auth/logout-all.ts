import { callApi, jsonResponse, passThrough, type Env } from '../../../server/upstream';
import { clearTokenCookies, readCookie, REFRESH_COOKIE } from '../../../server/cookies';
import { refuseCrossSite } from '../../../server/security';

// POST /api/auth/logout-all: revokes every session of the user, on every device, this one included. Unlike logout, a
// failure is passed to the browser and the cookies are kept: the user must know the other sessions are still open,
// and can try again.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const refused = refuseCrossSite(request);
  if (refused) return refused;

  const refreshToken = readCookie(request, REFRESH_COOKIE);
  if (!refreshToken) {
    const headers = new Headers();
    clearTokenCookies(headers);
    return jsonResponse(401, { message: 'No session', code: 'AUTH_SESSION_MISSING' }, headers);
  }

  const upstream = await callApi(env, '/auth/logout-all', {
    method  : 'POST',
    headers : { 'Content-Type': 'application/json' },
    body    : JSON.stringify({ refreshToken }),
  }, request);

  if (upstream.status !== 204) return passThrough(upstream);

  const headers = new Headers({ 'Cache-Control': 'no-store' });
  clearTokenCookies(headers);

  return new Response(null, { status: 204, headers });
};
