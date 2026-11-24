import { useState } from 'react';

type Dialog<T> =
  | { kind: 'create' }
  | { kind: 'edit'; record: T }
  | { kind: 'delete'; record: T }
  | null;

// Which dialog of a CRUD screen is open and for which record: creating, editing, deleting, or none.
export function useRecordDialogs<T>() {
  const [dialog, setDialog] = useState<Dialog<T>>(null);

  return {
    dialog,
    openCreate : () => setDialog({ kind: 'create' }),
    openEdit   : (record: T) => setDialog({ kind: 'edit', record }),
    openDelete : (record: T) => setDialog({ kind: 'delete', record }),
    close      : () => setDialog(null),
  };
}
