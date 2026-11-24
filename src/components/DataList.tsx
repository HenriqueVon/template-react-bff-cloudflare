import type { ReactNode } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { useT } from '@/i18n/i18n-context';
import type { ListViewMode } from '@/lib/storage';

export type Column<T> = {
  id      : string;
  header  : string;
  cell    : (row: T) => ReactNode;
  // The title of the card in the cards view. Exactly one column should be primary.
  primary? : boolean;
};

const ACTION_BUTTON = 'inline-flex items-center justify-center rounded-md p-2 transition-colors';

// Edit and delete. The name of the record is in the label, so a screen reader hears which one it acts on.
function RowActions({ name, onEdit, onDelete }: { name: string; onEdit: () => void; onDelete: () => void }) {
  const t = useT();

  return (
    <div className="inline-flex items-center gap-1">
      <button type="button" onClick={onEdit} aria-label={t('list.editRow', { name })} title={t('common.edit')} className={`${ACTION_BUTTON} text-on-surface-variant hover:bg-surface-variant hover:text-primary`}>
        <Pencil size={18} aria-hidden="true" />
      </button>
      <button type="button" onClick={onDelete} aria-label={t('list.deleteRow', { name })} title={t('common.delete')} className={`${ACTION_BUTTON} text-on-surface-variant hover:bg-error-container/50 hover:text-error`}>
        <Trash2 size={18} aria-hidden="true" />
      </button>
    </div>
  );
}

type DataListProps<T> = {
  // The name of the list, for screen readers.
  label    : string;
  rows     : T[];
  columns  : Column<T>[];
  rowKey   : (row: T) => string;
  // How a record is called in the buttons: "Edit First example".
  rowName  : (row: T) => string;
  view     : ListViewMode;
  onEdit   : (row: T) => void;
  onDelete : (row: T) => void;
};

// The same records as a table or as cards, as the user chose. Both have the same columns and the same buttons.
export function DataList<T>({ label, rows, columns, rowKey, rowName, view, onEdit, onDelete }: DataListProps<T>) {
  const t = useT();

  if (view === 'cards') {
    const primary = columns.find((column) => column.primary) ?? columns[0];
    const others = columns.filter((column) => column !== primary);

    return (
      <ul aria-label={label} className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <li key={rowKey(row)} className="flex flex-col gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4">
            <div className="text-body-lg font-medium text-on-surface">{primary.cell(row)}</div>
            {others.length > 0 && (
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-body-md">
                {others.map((column) => (
                  <div key={column.id} className="contents">
                    <dt className="text-on-surface-variant">{column.header}</dt>
                    <dd className="text-on-surface">{column.cell(row)}</dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="flex justify-end border-t border-outline-variant/20 pt-2">
              <RowActions name={rowName(row)} onEdit={() => onEdit(row)} onDelete={() => onDelete(row)} />
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    // `relative` so the hidden labels (sr-only, which are positioned) are clipped with the table instead of widening the
    // page: without it a wide table made the whole page scroll sideways on a tablet.
    <div className="relative overflow-x-auto">
      <table className="w-full border-collapse text-left">
        <caption className="sr-only">{label}</caption>
        <thead>
          <tr className="border-b border-outline-variant/60 bg-surface-container-low/50">
            {columns.map((column) => (
              <th key={column.id} scope="col" className="whitespace-nowrap px-5 py-3 text-label-sm uppercase tracking-wider text-on-surface-variant">{column.header}</th>
            ))}
            <th scope="col" className="px-5 py-3"><span className="sr-only">{t('common.actions')}</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-outline-variant/30">
          {rows.map((row) => (
            <tr key={rowKey(row)}>
              {columns.map((column) => (
                <td key={column.id} className={`px-5 py-4 text-body-md ${column.primary ? 'font-medium text-on-surface' : 'text-on-surface-variant'}`}>{column.cell(row)}</td>
              ))}
              <td className="whitespace-nowrap px-5 py-4 text-right">
                <RowActions name={rowName(row)} onEdit={() => onEdit(row)} onDelete={() => onDelete(row)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
