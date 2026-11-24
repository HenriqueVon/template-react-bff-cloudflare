// A list the API pages: the screen asks for one page at a time, with `limit` and `offset`, and the API answers with
// the items of the page and the total.

export type ListResponse<T> = { items: T[]; total: number };

export type PageParams = { limit: number; offset: number };

// How many records a page of a list screen holds.
export const SCREEN_PAGE_SIZE = 20;

// The page is counted from 0 in the code and from 1 on the screen.
export function pageParams(page: number, size = SCREEN_PAGE_SIZE): PageParams {
  return { limit: size, offset: page * size };
}
