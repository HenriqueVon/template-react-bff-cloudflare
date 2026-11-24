import type { ReactNode } from 'react';
import type { UseQueryResult } from '@tanstack/react-query';
import { Plus, type LucideIcon } from 'lucide-react';
import { SCREEN_PAGE_SIZE, type ListResponse } from '@/api/pagination';
import { Button } from './Button';
import { Card } from './Card';
import { DataList, type Column } from './DataList';
import { PageHeader } from './PageHeader';
import { Pagination } from './Pagination';
import { EmptyBlock, ErrorBlock, SkeletonRows } from './states';
import { useListView } from './use-list-view';
import { ViewToggle } from './ViewToggle';

type PagedListScreenProps<T> = {
  title            : string;
  description      : string;
  // The button of the header, such as "New example".
  createLabel      : string;
  onCreate         : () => void;
  // The filters of the list, shown above it (a search box, a period). Optional.
  filters?         : ReactNode;
  query            : UseQueryResult<ListResponse<T>>;
  page             : number;
  onPage           : (page: number) => void;
  columns          : Column<T>[];
  rowKey           : (row: T) => string;
  rowName          : (row: T) => string;
  onEdit           : (row: T) => void;
  onDelete         : (row: T) => void;
  emptyIcon        : LucideIcon;
  emptyTitle       : string;
  emptyDescription : string;
  // The records per page the query asks for. Default: SCREEN_PAGE_SIZE.
  pageSize?        : number;
};

// A screen for a list that grows with use: the API pages (and filters) it, and the screen shows one page at a time.
// It has the header with the create button, the choice of table or cards, the pages, and the loading, error and empty
// states.
export function PagedListScreen<T>({
  title, description, createLabel, onCreate, filters, query, page, onPage, columns, rowKey, rowName, onEdit, onDelete,
  emptyIcon, emptyTitle, emptyDescription, pageSize = SCREEN_PAGE_SIZE,
}: PagedListScreenProps<T>) {
  const [view, setView] = useListView();

  const items = query.data?.items ?? [];
  const total = query.data?.total ?? 0;

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button className="w-full md:w-auto" onClick={onCreate}>
            <Plus size={18} aria-hidden="true" />
            {createLabel}
          </Button>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b border-outline-variant/30 p-4">
          <div className="flex flex-wrap items-end gap-3">{filters}</div>
          <ViewToggle value={view} onChange={setView} />
        </div>

        {query.isPending ? (
          <SkeletonRows rows={5} />
        ) : query.isError ? (
          <ErrorBlock error={query.error} onRetry={() => void query.refetch()} />
        ) : total === 0 ? (
          <EmptyBlock icon={emptyIcon} title={emptyTitle} description={emptyDescription} />
        ) : (
          <>
            {/* The previous page stays visible, dimmed, while the next one loads. */}
            <div aria-busy={query.isPlaceholderData} className={query.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
              <DataList label={title} rows={items} columns={columns} rowKey={rowKey} rowName={rowName} view={view} onEdit={onEdit} onDelete={onDelete} />
            </div>
            <Pagination page={page} total={total} onPage={onPage} busy={query.isPlaceholderData} pageSize={pageSize} />
          </>
        )}
      </Card>
    </>
  );
}
