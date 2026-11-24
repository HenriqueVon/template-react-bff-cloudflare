import { callApi, jsonResponse, type Env } from '../../../server/upstream';
import { clearTokenCookies, readCookie, REFRESH_COOKIE } from '../../../server/cookies';
import { refuseCrossSite } from '../../../server/security';
import { failedSessionResponse, sessionResponse } from '../../../server/session';

// POST /api/auth/refresh: exchanges the refresh token cookie for new tokens.
//
// An API that rotates refresh tokens usually ends the whole session when a replaced token is used again, so two
// refreshes at the same time would end it. The browser code makes sure only one runs at a time, across tabs.
export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const refused = refuseCrossSite(request);
  if (refused) return refused;

  const refreshToken = readCookie(request, REFRESH_COOKIE);
  if (!refreshToken) {
    const headers = new Headers();
    clearTokenCookies(headers);
    return jsonResponse(401, { message: 'No session', code: 'AUTH_SESSION_MISSING' }, headers);
  }

  const upstream = await callApi(env, '/auth/refresh', {
    method  : 'POST',
    headers : { 'Content-Type': 'application/json' },
    body    : JSON.stringify({ refreshToken }),
  }, request);

  // 401 and 403: the session or the access of the user can no longer be used. A 429 or a 5xx keeps the cookies, so a
  // temporary failure does not log the user out.
  if (!upstream.ok) return failedSessionResponse(upstream, upstream.status === 401 || upstream.status === 403);

  return sessionResponse(upstream);
};
