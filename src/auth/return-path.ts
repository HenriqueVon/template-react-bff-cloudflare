// The page the user wanted before the login comes from the URL, so it must be checked before the app
// navigates to it: only a path of this app is accepted. Anything else (another site, a protocol-relative
// URL, a backslash trick, the login pages themselves) becomes the home page.
const HOME = '/';
const LOGIN_PATHS = ['/login', '/auth/callback'];

export function safeReturnPath(path: string | null | undefined): string {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return HOME;
  if ([...path].some((character) => character.charCodeAt(0) < 32)) return HOME;

  const pathname = path.split(/[?#]/)[0];
  if (LOGIN_PATHS.includes(pathname)) return HOME;

  return path;
}
