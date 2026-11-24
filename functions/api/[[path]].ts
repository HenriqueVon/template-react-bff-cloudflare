import { PAYLOAD_TOO_LARGE, readBodyWithLimit } from '../../server/body';
import { ALLOWED_ROUTES } from '../../server/routes';
import { callApi, jsonResponse, passThrough, type Env } from '../../server/upstream';
import { ACCESS_COOKIE, readCookie } from '../../server/cookies';
import { refuseCrossSite } from '../../server/security';

const BODY_HEADERS = ['Content-Type'];

// /api/<path>: forwards a call to the API with its key and the access token cookie as the Bearer token.
export const onRequest: PagesFunction<Env, 'path'> = async ({ request, env, params }) => {
  const refused = refuseCrossSite(request);
  if (refused) return refused;

  const segments = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..' || segment === '')) {
    return jsonResponse(404, { message: 'Not found', code: 'NOT_FOUND' });
  }

  const path = segments.map(encodeURIComponent).join('/');
  const route = ALLOWED_ROUTES.find((allowed) => allowed.path.test(path));
  if (!route) {
    return jsonResponse(404, { message: 'Not found', code: 'NOT_FOUND' });
  }

  if (!route.methods.includes(request.method)) {
    return jsonResponse(405, { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, { Allow: route.methods.join(', ') });
  }

  // The cookie expires with the access token, so a missing cookie means the browser must refresh.
  const accessToken = readCookie(request, ACCESS_COOKIE);
  if (!accessToken) {
    return jsonResponse(401, { message: 'Token expired', code: 'AUTH_TOKEN_EXPIRED' });
  }

  const headers = new Headers({ Authorization: `Bearer ${accessToken}` });
  for (const name of BODY_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }

  const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
  const body = hasBody ? await readBodyWithLimit(request) : undefined;
  if (body === null) {
    return jsonResponse(413, PAYLOAD_TOO_LARGE);
  }

  const search = new URL(request.url).search;

  const upstream = await callApi(env, `/${path}${search}`, {
    method : request.method,
    headers,
    body,
  }, request);

  return passThrough(upstream);
};
