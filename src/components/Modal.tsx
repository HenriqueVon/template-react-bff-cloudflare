import { useEffect, useId, useRef, type ReactNode } from 'react';

// A modal built on the native <dialog>: it traps the focus, closes on Escape and is announced as a dialog.
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();

    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-xl bg-surface-container-lowest p-6 text-on-surface shadow-xl backdrop:bg-black/40"
    >
      <h2 id={titleId} className="mb-4 text-headline-sm">{title}</h2>
      {children}
    </dialog>
  );
}
