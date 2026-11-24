import { useState } from 'react';
import { Layers } from 'lucide-react';
import { exampleResource, useExamplePage, type CreateExampleInput, type Example } from '@/api/examples';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import type { Column } from '@/components/DataList';
import { PagedListScreen } from '@/components/PagedListScreen';
import { useRecordDialogs } from '@/components/record-dialogs';
import { useToast } from '@/components/toast-context';
import { useI18n, type Translate } from '@/i18n/i18n-context';
import { useFormat } from '@/i18n/use-format';
import { changedFields } from '@/lib/changed-fields';
import { saveErrorMessage, errorMessage } from '@/lib/errors';
import { ExampleFormDialog } from './ExampleFormDialog';

const columnsOf = (t: Translate, formatDate: (value: string) => string): Column<Example>[] => [
  { id: 'name', header: t('common.name'), primary: true, cell: (example) => example.name },
  { id: 'description', header: t('common.description'), cell: (example) => example.description ?? '' },
  { id: 'createdAt', header: t('common.created'), cell: (example) => formatDate(example.createdAt) },
];

// The reference screen: a paged list with create, edit and delete. Copy this folder, the resource module in
// src/api/ and the messages in src/i18n/messages/ when you add a screen.
export function ExamplesPage() {
  const { t, tx } = useI18n();
  const format = useFormat();
  const [page, setPage] = useState(0);
  const query = useExamplePage(page);
  const create = exampleResource.useCreate();
  const update = exampleResource.useUpdate();
  const remove = exampleResource.useRemove();
  const dialogs = useRecordDialogs<Example>();
  const toast = useToast();
  const [error, setError] = useState<string | null>(null);

  const open = (action: () => void) => {
    setError(null);
    action();
  };

  async function save(values: CreateExampleInput) {
    setError(null);

    try {
      if (dialogs.dialog?.kind === 'edit') {
        const { record } = dialogs.dialog;
        // Only what changed is sent, so a field that did not change is never checked again by the API.
        const changes = changedFields<CreateExampleInput>({ name: record.name, description: record.description }, values);
        if (Object.keys(changes).length > 0) await update.mutateAsync({ id: record.id, body: changes });
        toast.show(t('examples.updated'));
      } else {
        await create.mutateAsync(values);
        toast.show(t('examples.created'));
      }

      dialogs.close();
    } catch (failure) {
      setError(saveErrorMessage(failure, t, t('examples.duplicate')));
    }
  }

  async function confirmDelete(example: Example) {
    setError(null);

    try {
      await remove.mutateAsync(example.id);
      toast.show(t('examples.deleted'));
      dialogs.close();

      // Deleting the last record of a page leaves that page empty: go back to the one before.
      if (query.data && query.data.items.length === 1 && page > 0) setPage(page - 1);
    } catch (failure) {
      setError(errorMessage(failure, t));
    }
  }

  const { dialog } = dialogs;

  return (
    <>
      <PagedListScreen
        title={t('examples.title')}
        description={t('examples.description')}
        createLabel={t('examples.create')}
        onCreate={() => open(dialogs.openCreate)}
        query={query}
        page={page}
        onPage={setPage}
        columns={columnsOf(t, format.date)}
        rowKey={(example) => example.id}
        rowName={(example) => example.name}
        onEdit={(example) => open(() => dialogs.openEdit(example))}
        onDelete={(example) => open(() => dialogs.openDelete(example))}
        emptyIcon={Layers}
        emptyTitle={t('examples.empty.title')}
        emptyDescription={t('examples.empty.description')}
      />

      {(dialog?.kind === 'create' || dialog?.kind === 'edit') && (
        <ExampleFormDialog
          key={dialog.kind === 'edit' ? dialog.record.id : 'new'}
          example={dialog.kind === 'edit' ? dialog.record : undefined}
          pending={create.isPending || update.isPending}
          error={error}
          onSubmit={(values) => void save(values)}
          onClose={dialogs.close}
        />
      )}

      {dialog?.kind === 'delete' && (
        <ConfirmDialog
          title={t('examples.deleteTitle')}
          confirmLabel={t('common.delete')}
          danger
          pending={remove.isPending}
          error={error}
          onConfirm={() => void confirmDelete(dialog.record)}
          onCancel={dialogs.close}
        >
          {tx('examples.deleteBody', { name: <strong className="text-on-surface">{dialog.record.name}</strong> })}
        </ConfirmDialog>
      )}
    </>
  );
}
