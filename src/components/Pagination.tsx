import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SCREEN_PAGE_SIZE } from '@/api/pagination';
import { useT } from '@/i18n/i18n-context';
import { Button } from './Button';

// The pages of a list that the API pages for us. The page is counted from 0 in the code and from 1 on the
// screen.
export function Pagination({ page, total, onPage, busy = false, pageSize = SCREEN_PAGE_SIZE }: {
  page   : number;
  total  : number;
  onPage : (page: number) => void;
  // True while the next page loads: the buttons wait, so a click cannot skip a page.
  busy?  : boolean;
  // How many records a page holds: the one the list asked the API for.
  pageSize? : number;
}) {
  const t = useT();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : page * pageSize + 1;
  const last = Math.min(total, (page + 1) * pageSize);

  return (
    <nav aria-label={t('pagination.nav')} className="flex flex-col gap-3 border-t border-outline-variant/30 p-4 md:flex-row md:items-center md:justify-between">
      <p aria-live="polite" className="text-body-md text-on-surface-variant">
        {t(total === 1 ? 'pagination.range.one' : 'pagination.range.other', { first, last, total })}
      </p>
      <div className="flex items-center justify-between gap-3 md:justify-end">
        <Button variant="secondary" size="sm" disabled={busy || page === 0} onClick={() => onPage(page - 1)}>
          <ChevronLeft size={16} aria-hidden="true" />
          {t('pagination.previous')}
        </Button>
        <span className="text-body-md text-on-surface-variant">{t('pagination.page', { page: page + 1, pages })}</span>
        <Button variant="secondary" size="sm" disabled={busy || page + 1 >= pages} onClick={() => onPage(page + 1)}>
          {t('pagination.next')}
          <ChevronRight size={16} aria-hidden="true" />
        </Button>
      </div>
    </nav>
  );
}
