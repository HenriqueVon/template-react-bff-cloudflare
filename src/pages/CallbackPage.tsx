import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useAuth } from '@/auth/auth-context';
import { CALLBACK_PATH, parseCallback } from '@/auth/callback';
import { safeReturnPath } from '@/auth/return-path';
import { LoadingScreen } from '@/components/LoadingScreen';
import { takeReturnPath } from '@/lib/storage';

// Where the sign-in service sends the browser after Google, with ?code&state (or ?error&state). It finishes the login
// through the Functions and goes on to the page the user wanted.
export function CallbackPage() {
  const { completeLogin, failLogin, retry } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  // The code works once. React runs effects twice in development, and a second exchange would fail.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const params = parseCallback(location.search);
    // The code and the state do not stay in the address bar or in the history.
    window.history.replaceState(null, '', CALLBACK_PATH);

    // Opened by hand, with no login in progress: the app was not checking the session on this page, so check it now, and
    // go home.
    if (params.kind === 'empty') {
      retry();
      navigate('/', { replace: true });
      return;
    }

    if (params.kind === 'failed') {
      failLogin();
      navigate('/login', { replace: true });
      return;
    }

    void completeLogin(params.code, params.state).then((signedIn) => {
      navigate(signedIn ? safeReturnPath(takeReturnPath()) : '/login', { replace: true });
    });
  }, [location.search, navigate, completeLogin, failLogin, retry]);

  return <LoadingScreen />;
}
