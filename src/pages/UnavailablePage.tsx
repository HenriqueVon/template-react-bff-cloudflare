import { useAuth } from '@/auth/auth-context';
import { Button } from '@/components/Button';
import { CenteredCard } from '@/components/CenteredCard';
import { useT } from '@/i18n/i18n-context';
import { errorMessage } from '@/lib/errors';

// A temporary failure while checking the session. The user stays signed in: it is not a session problem.
export function UnavailablePage({ error }: { error: unknown }) {
  const t = useT();
  const { retry } = useAuth();

  return (
    <CenteredCard title={t('unavailable.title')}>
      <p className="text-body-md text-on-surface-variant">{errorMessage(error, t)}</p>
      <Button className="w-full" onClick={retry}>{t('unavailable.retry')}</Button>
    </CenteredCard>
  );
}
