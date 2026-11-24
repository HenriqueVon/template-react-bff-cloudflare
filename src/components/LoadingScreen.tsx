import { useT } from '@/i18n/i18n-context';
import { Spinner } from './Spinner';

export function LoadingScreen() {
  const t = useT();

  return (
    <div className="flex min-h-screen items-center justify-center text-primary-container" role="status">
      <Spinner />
      <span className="sr-only">{t('loading')}</span>
    </div>
  );
}
