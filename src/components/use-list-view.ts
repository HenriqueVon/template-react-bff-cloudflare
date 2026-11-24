import { useState } from 'react';
import { readListView, saveListView, type ListViewMode } from '@/lib/storage';

// The user's choice of how to see the lists, kept in this browser. Without a choice, a wide screen shows a
// table and a narrow one shows cards.
export function useListView(): [ListViewMode, (mode: ListViewMode) => void] {
  const [mode, setMode] = useState<ListViewMode>(
    () => readListView() ?? (window.matchMedia('(min-width: 768px)').matches ? 'table' : 'cards'),
  );

  const change = (next: ListViewMode) => {
    setMode(next);
    saveListView(next);
  };

  return [mode, change];
}
