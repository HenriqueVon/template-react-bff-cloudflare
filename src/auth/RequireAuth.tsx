import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { LoadingScreen } from '@/components/LoadingScreen';
import { NoAccessPage } from '@/pages/NoAccessPage';
import { UnavailablePage } from '@/pages/UnavailablePage';
import { useAuth } from './auth-context';

// Protected routes: without a session, go to the login and come back here afterwards.
export function RequireAuth({ children }: { children: ReactNode }) {
  const { state } = useAuth();
  const location = useLocation();

  switch (state.status) {
    case 'loading':
      return <LoadingScreen />;
    case 'anonymous':
      return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
    case 'forbidden':
      return <NoAccessPage code={state.code} />;
    case 'unavailable':
      return <UnavailablePage error={state.error} />;
    case 'authenticated':
      return children;
  }
}
