import { jsonResponse } from './upstream';

// The browser code sends this header on every call to /api. A cross-site form cannot set it, and a cross-site
// fetch with it needs a CORS preflight that the Functions never allow. `npm run init` sets the value to the name
// of the project; src/api/client.ts sends the same one.
export const CSRF_HEADER = 'X-Requested-With';
export const CSRF_VALUE = 'my-web-app';

const SAFE_METHODS = new Set(['GET', 'HEAD']);

// SameSite=Strict already keeps the session cookies off cross-site requests; this refuses a request that changes
// data unless it comes from the page itself.
export function refuseCrossSite(request: Request): Response | null {
  if (SAFE_METHODS.has(request.method)) return null;

  const origin = request.headers.get('Origin');
  const sameOrigin = origin !== null && origin === new URL(request.url).origin;

  if (!sameOrigin || request.headers.get(CSRF_HEADER) !== CSRF_VALUE) {
    return jsonResponse(403, { message: 'Cross-site request refused', code: 'CSRF_REJECTED' });
  }

  return null;
}
