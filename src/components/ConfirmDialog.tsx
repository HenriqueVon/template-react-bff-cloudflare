import type { ReactNode } from 'react';
import { useT } from '@/i18n/i18n-context';
import { Button } from './Button';
import { Modal } from './Modal';
import { Spinner } from './Spinner';

// Says what is about to happen and to whom, and shows the error if it fails (CLAUDE.md, conventions). The
// error is already a message in the language of the user: the screen knows which operation failed.
export function ConfirmDialog({ title, children, confirmLabel, danger = false, pending, error, onConfirm, onCancel }: {
  title        : string;
  children     : ReactNode;
  confirmLabel : string;
  danger?      : boolean;
  pending      : boolean;
  error?       : string | null;
  onConfirm    : () => void;
  onCancel     : () => void;
}) {
  const t = useT();

  return (
    <Modal title={title} onClose={pending ? () => undefined : onCancel}>
      <div className="space-y-4 text-body-md">
        <div className="text-on-surface-variant">{children}</div>
        {error && <p role="alert" className="text-error">{error}</p>}
        <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
          <Button variant="secondary" onClick={onCancel} disabled={pending}>{t('common.cancel')}</Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={pending}>
            {pending && <Spinner size={16} />}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
