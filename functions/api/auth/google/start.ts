import { jsonResponse, misconfigured, type Env } from '../../../../server/upstream';
import { setPkceCookie } from '../../../../server/cookies';
import { redirectUriOf } from '../../../../server/login';
import { challengeOf, generateState, generateVerifier } from '../../../../server/pkce';

// GET /api/auth/google/start: begins the Google login. It creates the PKCE verifier and the state, keeps both in an
// HttpOnly cookie and redirects the browser to the sign-in service, which sends it to Google and back to
// /auth/callback. It takes no body and changes nothing on the server.
export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const missing = (['AUTH_PUBLIC_URL', 'AUTH_CLIENT_ID'] as const).filter((name) => !env[name]);
  if (missing.length > 0) return misconfigured(missing);

  const verifier = generateVerifier();
  const state = generateState();

  const location = new URL(`${env.AUTH_PUBLIC_URL.replace(/\/+$/, '')}/v1/api/auth/google`);
  location.searchParams.set('client_id', env.AUTH_CLIENT_ID);
  location.searchParams.set('redirect_uri', redirectUriOf(request));
  location.searchParams.set('state', state);
  location.searchParams.set('code_challenge', await challengeOf(verifier));
  location.searchParams.set('code_challenge_method', 'S256');

  const headers = new Headers({ Location: location.toString(), 'Cache-Control': 'no-store' });
  setPkceCookie(headers, verifier, state);

  return new Response(null, { status: 302, headers });
};

// Any other method is refused instead of falling through to the proxy.
export const onRequest: PagesFunction<Env> = () =>
  jsonResponse(405, { message: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET' });
