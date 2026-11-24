import { callApi, jsonResponse, passThrough, type Env } from '../../server/upstream';
import { ACCESS_COOKIE, readCookie } from '../../server/cookies';
import { refuseCrossSite } from '../../server/security';

// The API routes the app may call through this proxy. The session routes (login, refresh, logout) have their own
// functions and are not reachable from here, and neither is anything else: a new path is added on purpose, never as
// a wildcard.
const ALLOWED_PATHS = [
  // Who is signed in. It also tells the app whether the session works (src/auth/probe.ts).
  /^auth\/me$/,
  // @template:example:start
  // The example resource. Replace it with the routes of your API.
  /^examples(\/[^/]+)?$/,
  // @template:example:end
];

// The methods of the API resources. Add PUT here only when the API has one.
const ALLOWED_METHODS = new Set(['GET', 'POST', 'PATCH', 'DELETE']);

const BODY_HEADERS = ['Content-Type'];

// /api/<path>: forwards a call to the API with its key and the access token cookie as the Bearer token.
export const onRequest: PagesFunction<Env, 'path'> = async ({ request, env, params }) => {
  if (!ALLOWED_METHODS.has(request.method)) {
    return jsonResponse(405, { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, { Allow: [...ALLOWED_METHODS].join(', ') });
  }

  const refused = refuseCrossSite(request);
  if (refused) return refused;

  const segments = Array.isArray(params.path) ? params.path : [params.path].filter(Boolean);
  if (segments.length === 0 || segments.some((segment) => segment === '.' || segment === '..' || segment === '')) {
    return jsonResponse(404, { message: 'Not found', code: 'NOT_FOUND' });
  }

  const path = segments.map(encodeURIComponent).join('/');
  if (!ALLOWED_PATHS.some((allowed) => allowed.test(path))) {
    return jsonResponse(404, { message: 'Not found', code: 'NOT_FOUND' });
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
  const search = new URL(request.url).search;

  const upstream = await callApi(env, `/${path}${search}`, {
    method : request.method,
    headers,
    body   : hasBody ? await request.arrayBuffer() : undefined,
  }, request);

  return passThrough(upstream);
};
