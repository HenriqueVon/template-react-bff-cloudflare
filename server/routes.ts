// The API routes the app may call through the proxy (functions/api/[[path]].ts), each with the methods it accepts. The
// session routes (login, refresh, logout) have their own functions and are not reachable from here, and neither is
// anything else: a new route is added on purpose, never as a wildcard, and never with a method the API does not define
// for it (the API has no PUT, and a read-only route is never forwarded a DELETE). The path is matched without the
// leading slash, after each segment is encoded.
export type AllowedRoute = { path: RegExp; methods: string[] };

export const ALLOWED_ROUTES: AllowedRoute[] = [
  // Who is signed in. It also tells the app whether the session works (src/auth/probe.ts).
  { path: /^auth\/me$/, methods: ['GET'] },
  // @template:example:start
  // The example resource. Replace it with the routes of your API.
  { path: /^examples$/, methods: ['GET', 'POST'] },
  { path: /^examples\/[^/]+$/, methods: ['GET', 'PATCH', 'DELETE'] },
  // @template:example:end
];
