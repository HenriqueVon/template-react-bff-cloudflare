import { createContext, useContext } from 'react';

// Why the last session ended, shown on the login page. A plain logout shows nothing.
export type SessionNotice = 'expired' | 'idle' | 'login_failed';

// Who is signed in, from GET /auth/me.
export type User = { id: string; name: string; email: string };

export type AuthState =
  | { status: 'loading' }
  | { status: 'anonymous'; notice: SessionNotice | null }
  | { status: 'authenticated'; user: User }
  | { status: 'forbidden'; code?: string }
  | { status: 'unavailable'; error: unknown };

export type AuthContextValue = {
  state         : AuthState;
  // @template:login-password:start
  // Signs in with an email and a password. Throws an ApiError when the API refuses; the session then does not start.
  login         : (email: string, password: string) => Promise<void>;
  // @template:login-password:end
  // @template:login-google:start
  // Sends the browser to Google, through the Functions. returnTo is the page to open afterwards.
  startLogin    : (returnTo: string) => void;
  // The last step of the login, on /auth/callback. Resolves true when the session started; on any failure the login
  // page shows a generic message and it resolves false.
  completeLogin : (code: string, state: string) => Promise<boolean>;
  // The login came back with an error, or without the data it needs.
  failLogin     : () => void;
  // @template:login-google:end
  // Checks the session again, after a temporary failure.
  retry         : () => void;
  logout        : () => Promise<void>;
  // Ends every session of the user, on every device. Throws when it could not; the session in this browser is then
  // kept.
  logoutAll     : () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}

// The user of a signed-in session. Only for screens inside RequireAuth.
export function useUser(): User {
  const { state } = useAuth();
  if (state.status !== 'authenticated') {
    throw new Error('useUser must be used inside RequireAuth');
  }

  return state.user;
}
