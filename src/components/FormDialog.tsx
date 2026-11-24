import { useRef, type FormEvent, type ReactNode } from 'react';
import { useT } from '@/i18n/i18n-context';
import { Button } from './Button';
import { Modal } from './Modal';
import { Spinner } from './Spinner';

// A modal with a form: the fields, the error of the last attempt, and the two buttons. The form does not use
// the validation of the browser (noValidate): the screen checks the fields and shows its own messages.
export function FormDialog({ title, submitLabel, pending, error, onClose, onSubmit, children }: {
  title        : string;
  // Defaults to "Save".
  submitLabel? : string;
  pending      : boolean;
  // The message of the last failed attempt, already in the language of the user.
  error?       : string | null;
  onClose      : () => void;
  onSubmit     : () => void;
  children     : ReactNode;
}) {
  const t = useT();
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit();

    // When the fields did not pass, the focus goes to the first one with an error, so a keyboard or screen
    // reader user lands on what has to be fixed. The messages are rendered after this handler returns.
    window.setTimeout(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
  };

  return (
    <Modal title={title} onClose={pending ? () => undefined : onClose}>
      <form ref={formRef} noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
        {children}
        {error && <p role="alert" className="rounded-lg bg-error-container/60 px-4 py-3 text-body-md text-on-error-container">{error}</p>}
        <div className="flex flex-col-reverse gap-2 border-t border-outline-variant/20 pt-4 md:flex-row md:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={pending}>{t('common.cancel')}</Button>
          <Button type="submit" disabled={pending}>
            {pending && <Spinner size={16} />}
            {pending ? t('common.saving') : (submitLabel ?? t('common.save'))}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
