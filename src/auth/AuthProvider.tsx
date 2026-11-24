import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  // @template:login-google:start
  exchangeCode,
  // @template:login-google:end
  // @template:login-password:start
  login as loginRequest,
  // @template:login-password:end
  logout as logoutRequest,
  logoutAll as logoutAllRequest,
  setSessionExpiredHandler,
} from '@/api/client';
import {
  readLastActivity,
  // @template:login-google:start
  saveReturnPath,
  // @template:login-google:end
} from '@/lib/storage';
import { AuthContext, type AuthState, type SessionNotice } from './auth-context';
// @template:login-google:start
import { CALLBACK_PATH } from './callback';
// @template:login-google:end
import { idleStatus } from './idle';
import { IdleWatcher } from './IdleWatcher';
import { probeSession, type SessionProbe } from './probe';
// @template:login-google:start
import { safeReturnPath } from './return-path';
// @template:login-google:end
import { openSessionChannel, type SessionChannel } from './session-channel';

// @template:login-google:start
const START_LOGIN_URL = '/api/auth/google/start';
// @template:login-google:end

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  // Whether the session is checked when the app opens. Decided once, on the first render.
  const [checkOnStart] = useState(() => {
    // @template:login-google:start
    // On the callback page the session does not exist yet: the page finishes the login itself and navigates away, and
    // the effect of a child runs before this one, so asking the URL again later would already see the new page.
    if (window.location.pathname === CALLBACK_PATH) return false;
    // @template:login-google:end
    return true;
  });
  const [state, setState] = useState<AuthState>(checkOnStart ? { status: 'loading' } : { status: 'anonymous', notice: null });
  const authenticated = useRef(false);
  // Every check of the session gets a number; the answer of an older one is ignored.
  const generation = useRef(0);
  const channel = useRef<SessionChannel | null>(null);

  const endSession = useCallback((notice: SessionNotice | null) => {
    authenticated.current = false;
    generation.current += 1;
    queryClient.clear();
    setState({ status: 'anonymous', notice });
  }, [queryClient]);

  const logout = useCallback(async () => {
    await logoutRequest();
    channel.current?.postLogout('logout');
    endSession(null);
  }, [endSession]);

  const logoutIdle = useCallback(async () => {
    await logoutRequest();
    channel.current?.postLogout('idle');
    endSession('idle');
  }, [endSession]);

  // Applies the answer of the API about the session. After a closed or sleeping tab, the idle time still counts, so
  // reopening the app does not bring a session back.
  const applyProbe = useCallback(async (result: SessionProbe, current: number, checkIdle: boolean) => {
    if (current !== generation.current) return;

    if (result.status === 'authenticated') {
      const lastActivity = readLastActivity();
      if (checkIdle && lastActivity !== null && idleStatus(lastActivity, Date.now()) === 'idle') {
        await logoutIdle();
        return;
      }

      authenticated.current = true;
      setState({ status: 'authenticated', user: result.user });
      return;
    }

    authenticated.current = false;
    if (result.status === 'anonymous') setState({ status: 'anonymous', notice: null });
    else if (result.status === 'forbidden') setState({ status: 'forbidden', code: result.code });
    else setState({ status: 'unavailable', error: result.error });
  }, [logoutIdle]);

  const loadSession = useCallback(async (checkIdle: boolean) => {
    const current = ++generation.current;
    await applyProbe(await probeSession(), current, checkIdle);
  }, [applyProbe]);

  useEffect(() => {
    // A session that ends while the app is open shows "session expired" on the login page; no session on the first load
    // just shows the login page.
    setSessionExpiredHandler(() => endSession(authenticated.current ? 'expired' : null));

    // Another tab logged out: the shared cookies are already cleared.
    const sessionChannel = openSessionChannel((reason) => {
      if (authenticated.current) endSession(reason === 'idle' ? 'idle' : null);
    });
    channel.current = sessionChannel;

    if (checkOnStart) {
      const current = ++generation.current;
      void probeSession().then((result) => applyProbe(result, current, true));
    }

    return () => {
      setSessionExpiredHandler(null);
      sessionChannel.close();
      channel.current = null;
    };
  }, [endSession, applyProbe, checkOnStart]);

  // @template:login-password:start
  const login = useCallback(async (email: string, password: string) => {
    await loginRequest(email, password);

    queryClient.clear();
    await loadSession(false);
  }, [loadSession, queryClient]);
  // @template:login-password:end

  // @template:login-google:start
  const startLogin = useCallback((returnTo: string) => {
    saveReturnPath(safeReturnPath(returnTo));
    window.location.assign(START_LOGIN_URL);
  }, []);

  const failLogin = useCallback(() => {
    setState((previous) => (previous.status === 'authenticated' ? previous : { status: 'anonymous', notice: 'login_failed' }));
  }, []);

  const completeLogin = useCallback(async (code: string, loginState: string) => {
    try {
      await exchangeCode(code, loginState);
    } catch {
      failLogin();
      return false;
    }

    queryClient.clear();
    await loadSession(false);
    return true;
  }, [failLogin, loadSession, queryClient]);
  // @template:login-google:end

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    void loadSession(false);
  }, [loadSession]);

  // Ends every session of the user, on every device. Other tabs of this browser share the cookies, so they leave like on
  // a logout. Other devices find out on their next call.
  const logoutAll = useCallback(async () => {
    await logoutAllRequest();
    channel.current?.postLogout('logout');
    endSession(null);
  }, [endSession]);

  const value = useMemo(
    () => ({
      state,
      // @template:login-password:start
      login,
      // @template:login-password:end
      // @template:login-google:start
      startLogin,
      completeLogin,
      failLogin,
      // @template:login-google:end
      retry,
      logout,
      logoutAll,
    }),
    [
      state,
      // @template:login-password:start
      login,
      // @template:login-password:end
      // @template:login-google:start
      startLogin,
      completeLogin,
      failLogin,
      // @template:login-google:end
      retry,
      logout,
      logoutAll,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {state.status === 'authenticated' && <IdleWatcher onIdle={logoutIdle} onLogout={logout} />}
    </AuthContext.Provider>
  );
}
