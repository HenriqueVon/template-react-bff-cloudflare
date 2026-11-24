// The page the sign-in service sends the browser back to after Google. It is a route of the SPA.
export const CALLBACK_PATH = '/auth/callback';

// The redirect_uri of the login: the start and the exchange must send exactly the same value, and the sign-in
// service compares it with the redirect URLs registered for this app. It is built from the origin the browser used,
// which Cloudflare sets.
export function redirectUriOf(request: Request): string {
  return `${new URL(request.url).origin}${CALLBACK_PATH}`;
}
