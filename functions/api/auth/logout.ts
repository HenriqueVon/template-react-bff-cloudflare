import { callApi, type Env } from '../../../server/upstream';
import { clearTokenCookies, readCookie, REFRESH_COOKIE } from '../../../server/cookies';
import { refuseCrossSite } from '../../../server/security';

// POST /api/auth/logout: revokes the session and clears the cookies. Always 204, so the browser can always leave.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const refused = refuseCrossSite(request);
  if (refused) return refused;

  const refreshToken = readCookie(request, REFRESH_COOKIE);
  if (refreshToken) {
    await callApi(env, '/auth/logout', {
      method  : 'POST',
      headers : { 'Content-Type': 'application/json' },
      body    : JSON.stringify({ refreshToken }),
    }, request);
  }

  const headers = new Headers({ 'Cache-Control': 'no-store' });
  clearTokenCookies(headers);

  return new Response(null, { status: 204, headers });
};
