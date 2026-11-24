import { LayoutGrid, Table } from 'lucide-react';
import { useT } from '@/i18n/i18n-context';
import type { MessageKey } from '@/i18n/messages';
import type { ListViewMode } from '@/lib/storage';

const OPTIONS: { mode: ListViewMode; labelKey: MessageKey; icon: typeof Table }[] = [
  { mode: 'table', labelKey: 'view.table', icon: Table },
  { mode: 'cards', labelKey: 'view.cards', icon: LayoutGrid },
];

// The choice between the table and the cards (see use-list-view.ts for where it is kept).
export function ViewToggle({ value, onChange }: { value: ListViewMode; onChange: (mode: ListViewMode) => void }) {
  const t = useT();

  return (
    <div role="group" aria-label={t('view.label')} className="inline-flex overflow-hidden rounded-lg border border-outline-variant/60 bg-surface-container-lowest">
      {OPTIONS.map(({ mode, labelKey, icon: Icon }) => (
        <button
          key={mode}
          type="button"
          aria-pressed={value === mode}
          onClick={() => onChange(mode)}
          className={`inline-flex items-center gap-2 px-3 py-2 text-label-md transition-colors ${
            value === mode ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant hover:bg-surface-container-low'
          }`}
        >
          <Icon size={16} aria-hidden="true" />
          <span className="hidden sm:inline">{t(labelKey)}</span>
          <span className="sr-only sm:hidden">{t(labelKey)}</span>
        </button>
      ))}
    </div>
  );
}
