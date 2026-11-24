// @template:example:start
import { Link } from 'react-router';
import { useExamplePage } from '@/api/examples';
// @template:example:end
import { useUser } from '@/auth/auth-context';
import { Card } from '@/components/Card';
import { PageHeader } from '@/components/PageHeader';
// @template:example:start
import { ErrorBlock, LoadingBlock } from '@/components/states';
// @template:example:end
import { useT } from '@/i18n/i18n-context';

// The home page. It greets the user and, as an example of reading data, says how many examples exist. Replace it with
// the overview of your app.
export function HomePage() {
  const t = useT();
  const user = useUser();
  // @template:example:start
  const examples = useExamplePage(0);
  // @template:example:end

  return (
    <>
      <PageHeader title={t('home.title')} description={t('home.description')} />

      <Card className="space-y-3 p-6">
        <p className="text-body-lg text-on-surface">{t('home.greeting', { name: user.name })}</p>
        {/* @template:example:start */}
        {examples.isPending ? (
          <LoadingBlock />
        ) : examples.isError ? (
          <ErrorBlock error={examples.error} onRetry={() => void examples.refetch()} />
        ) : (
          <>
            <p className="text-body-md text-on-surface-variant">
              {t(examples.data.total === 1 ? 'home.examples.one' : 'home.examples.other', { count: examples.data.total })}
            </p>
            <Link to="/examples" className="inline-block rounded-lg bg-primary-container px-4 py-2.5 text-label-md text-on-primary hover:bg-primary">
              {t('home.examples.open')}
            </Link>
          </>
        )}
        {/* @template:example:end */}
      </Card>
    </>
  );
}
