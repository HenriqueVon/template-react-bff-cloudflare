import { useState } from 'react';
import { ApiError } from '@/api/client';
import { useAuth } from '@/auth/auth-context';
import { Button } from '@/components/Button';
import { CenteredCard } from '@/components/CenteredCard';
import { useT } from '@/i18n/i18n-context';
import { errorMessage } from '@/lib/errors';

// The session is valid, but the API gave this user no access to the app.
export function NoAccessPage({ code }: { code?: string }) {
  const t = useT();
  const { logout } = useAuth();
  const [error, setError] = useState<string | null>(null);

  // A logout that did not reach the Functions keeps the session: say so, and the user can try again.
  async function handleLogout() {
    setError(null);

    try {
      await logout();
    } catch (failure) {
      setError(errorMessage(failure, t));
    }
  }

  return (
    <CenteredCard title={t('noAccess.title')}>
      <p className="text-body-md text-on-surface-variant">{errorMessage(new ApiError(403, 'Forbidden', code), t)}</p>
      {error && <p role="alert" className="text-body-md text-error">{error}</p>}
      <Button variant="secondary" className="w-full" onClick={() => void handleLogout()}>{t('user.signOut')}</Button>
    </CenteredCard>
  );
}
