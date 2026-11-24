import type { ReactNode } from 'react';
import { CircleAlert, Inbox, RefreshCw, type LucideIcon } from 'lucide-react';
import { useT } from '@/i18n/i18n-context';
import { errorMessage } from '@/lib/errors';
import { Button } from './Button';
import { Spinner } from './Spinner';

// The three states every screen that loads data shows (CLAUDE.md, conventions): loading, error, empty.

export function LoadingBlock({ label }: { label?: string }) {
  const t = useT();

  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 py-16 text-on-surface-variant">
      <Spinner />
      <p className="text-body-md">{label ?? t('loading')}</p>
    </div>
  );
}

export function SkeletonRows({ rows = 4 }: { rows?: number }) {
  const t = useT();

  return (
    <div role="status" aria-label={t('loading')} className="space-y-3 p-6">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="h-10 animate-pulse rounded-lg bg-surface-container motion-reduce:animate-none" />
      ))}
    </div>
  );
}

// The message comes from errorMessage, by error code; the raw message of the server is never shown.
export function ErrorBlock({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const t = useT();

  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-error-container text-on-error-container">
        <CircleAlert size={22} aria-hidden="true" />
      </div>
      <p className="text-body-lg text-on-surface">{t('state.errorTitle')}</p>
      <p className="max-w-md text-body-md text-on-surface-variant">{errorMessage(error, t)}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw size={16} aria-hidden="true" />
          {t('common.retry')}
        </Button>
      )}
    </div>
  );
}

export function EmptyBlock({ icon: Icon = Inbox, title, description, action }: {
  icon?        : LucideIcon;
  title        : string;
  description? : string;
  action?      : ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
        <Icon size={22} aria-hidden="true" />
      </div>
      <p className="text-body-lg text-on-surface">{title}</p>
      {description && <p className="max-w-md text-body-md text-on-surface-variant">{description}</p>}
      {action}
    </div>
  );
}
