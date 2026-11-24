import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

const CONTROL = 'w-full rounded-lg border bg-surface-container-lowest px-4 py-2.5 text-body-md text-on-surface transition-colors placeholder:text-outline focus:border-primary disabled:opacity-60';

// The label, the control and the message of a field, tied together for screen readers: the label points to
// the control, and the control points to its error or hint.
function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string | null; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-label-md text-on-surface-variant">{label}</label>
      {children}
      {error ? (
        <p id={`${id}-message`} role="alert" className="text-label-sm text-error">{error}</p>
      ) : hint ? (
        <p id={`${id}-message`} className="text-label-sm text-on-surface-variant">{hint}</p>
      ) : null}
    </div>
  );
}

type FieldProps = { label: string; error?: string | null; hint?: string };

export function TextField({ label, error, hint, className = '', ...props }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();

  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-message` : undefined}
        className={`${CONTROL} ${error ? 'border-error' : 'border-outline-variant/60'} ${className}`}
        {...props}
      />
    </Field>
  );
}

export function TextAreaField({ label, error, hint, className = '', ...props }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();

  return (
    <Field id={id} label={label} error={error} hint={hint}>
      <textarea
        id={id}
        rows={3}
        aria-invalid={error ? true : undefined}
        aria-describedby={error || hint ? `${id}-message` : undefined}
        className={`${CONTROL} ${error ? 'border-error' : 'border-outline-variant/60'} ${className}`}
        {...props}
      />
    </Field>
  );
}
