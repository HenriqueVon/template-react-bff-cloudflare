import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from './client';
import { pageParams, type ListResponse } from './pagination';

type ResourceConfig = {
  // The first part of every query key of the resource.
  key     : string;
  // The path under /api, such as /examples.
  path    : string;
  // The field the list is sorted by. The API accepts a different set for each resource.
  orderBy : string;
  // 'asc' (the default) or 'desc'.
  orderDirection? : 'asc' | 'desc';
};

// The resources of the API share the same five routes (list, create, get, update, delete), so their calls and hooks are
// the same. This builds them for one resource: plain calls (api) and the TanStack Query hooks over them. Every change
// invalidates what the resource cached, so the screen shows what was saved. A resource whose routes differ writes its
// own module instead of bending this one.
export function createResource<TEntity, TCreate, TUpdate>(config: ResourceConfig) {
  const keys = {
    all  : [config.key] as const,
    page : (page: number) => [config.key, 'page', page] as const,
    one  : (id: string | undefined) => [config.key, 'one', id] as const,
  };

  const api = {
    page: (page: number) => apiRequest<ListResponse<TEntity>>(config.path, {
      query: { ...pageParams(page), orderBy: config.orderBy, orderDirection: config.orderDirection ?? 'asc' },
    }),
    get    : (id: string) => apiRequest<TEntity>(`${config.path}/${encodeURIComponent(id)}`),
    create : (body: TCreate) => apiRequest<TEntity>(config.path, { method: 'POST', body }),
    update : (id: string, body: TUpdate) => apiRequest<TEntity>(`${config.path}/${encodeURIComponent(id)}`, { method: 'PATCH', body }),
    remove : (id: string) => apiRequest<void>(`${config.path}/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  };

  // One page of the list. The previous page stays on the screen while the next one loads.
  function usePage(page: number) {
    return useQuery({ queryKey: keys.page(page), queryFn: () => api.page(page), placeholderData: keepPreviousData });
  }

  // One record, for the screens that edit it on their own page. The id may be missing while the address loads.
  function useOne(id: string | undefined) {
    return useQuery({
      queryKey : keys.one(id),
      queryFn  : () => api.get(id as string),
      enabled  : id !== undefined,
    });
  }

  function useCreate() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn : api.create,
      onSuccess  : () => queryClient.invalidateQueries({ queryKey: keys.all }),
    });
  }

  function useUpdate() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn : ({ id, body }: { id: string; body: TUpdate }) => api.update(id, body),
      onSuccess  : () => queryClient.invalidateQueries({ queryKey: keys.all }),
    });
  }

  function useRemove() {
    const queryClient = useQueryClient();

    return useMutation({
      mutationFn : api.remove,
      onSuccess  : () => queryClient.invalidateQueries({ queryKey: keys.all }),
    });
  }

  return { keys, api, usePage, useOne, useCreate, useUpdate, useRemove };
}
