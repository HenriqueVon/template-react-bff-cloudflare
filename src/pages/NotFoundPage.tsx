import { Link } from 'react-router';
import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
import { EmptyBlock } from '@/components/states';
import { useT } from '@/i18n/i18n-context';

// Inside the shell: an address that does not exist, for a user who is signed in.
export function NotFoundPage() {
  const t = useT();

  return (
    <>
      <PageHeader title={t('notFound.title')} />
      <Card>
        <EmptyBlock
          title={t('notFound.message')}
          action={<Link to="/" className="rounded-lg bg-primary-container px-4 py-2.5 text-label-md text-on-primary">{t('notFound.home')}</Link>}
        />
      </Card>
    </>
  );
}
