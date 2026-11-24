// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/i18n/test-render';
import { describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from './ConfirmDialog';
import { FormDialog } from './FormDialog';

describe('ConfirmDialog', () => {
  const setup = (props: { pending?: boolean; error?: string | null } = {}) => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <ConfirmDialog title="Delete example" confirmLabel="Delete" danger pending={props.pending ?? false} error={props.error} onConfirm={onConfirm} onCancel={onCancel}>
        Delete the example <strong>TRIP</strong>? This cannot be undone.
      </ConfirmDialog>,
    );

    return { onConfirm, onCancel };
  };

  it('should say what is about to happen and to whom', () => {
    setup();

    expect(screen.getByRole('dialog', { name: 'Delete example' })).toBeTruthy();
    expect(screen.getByText('TRIP')).toBeTruthy();
    expect(screen.getByText(/cannot be undone/)).toBeTruthy();
  });

  it('should delete only when the user confirms', async () => {
    const { onConfirm, onCancel } = setup();

    expect(onConfirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('should cancel from the button and from Escape', async () => {
    const { onConfirm, onCancel } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));

    expect(onCancel).toHaveBeenCalledTimes(2);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('should show the message of a failed delete', () => {
    setup({ error: 'The example could not be deleted: it is in use.' });

    expect(screen.getByRole('alert').textContent).toContain('is in use');
  });

  it('should not let the user close it or confirm twice while the delete runs', async () => {
    const { onConfirm, onCancel } = setup({ pending: true });

    expect((screen.getByRole('button', { name: /Delete/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    await userEvent.click(screen.getByRole('button', { name: /Delete/ }));

    expect(onCancel).not.toHaveBeenCalled();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('FormDialog', () => {
  const setup = (props: { pending?: boolean; error?: string | null; invalid?: boolean } = {}) => {
    const onSubmit = vi.fn();
    const onClose = vi.fn();

    render(
      <FormDialog title="New example" pending={props.pending ?? false} error={props.error} onClose={onClose} onSubmit={onSubmit}>
        <label>
          Name
          <input name="name" />
        </label>
        <label>
          Description
          <input name="description" aria-invalid={props.invalid ? true : undefined} />
        </label>
      </FormDialog>,
    );

    return { onSubmit, onClose };
  };

  it('should hand the submit to the screen instead of using the validation of the browser', async () => {
    const { onSubmit } = setup();

    expect(screen.getByRole('dialog', { name: 'New example' }).querySelector('form')?.hasAttribute('novalidate')).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('should move the focus to the first field with an error', async () => {
    setup({ invalid: true });

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText('Description')));
  });

  it('should show the error of the last attempt', () => {
    setup({ error: 'An example with this name already exists.' });

    expect(screen.getByRole('alert').textContent).toContain('already exists');
  });

  it('should lock the form while it saves', async () => {
    const { onClose } = setup({ pending: true });

    expect((screen.getByRole('button', { name: /Saving/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('should close from Cancel', async () => {
    const { onClose } = setup();

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
