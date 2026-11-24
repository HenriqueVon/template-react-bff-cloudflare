import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createResource } from './resource';

type Thing = { id: string; name: string };

const things = createResource<Thing, { name: string }, { name?: string }>({
  key     : 'things',
  path    : '/things',
  orderBy : 'name',
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

describe('createResource', () => {
  let fetchMock: ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<Response>>>;

  beforeEach(() => {
    fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should give every resource its own query keys', () => {
    expect(things.keys.all).toEqual(['things']);
    expect(things.keys.page(2)).toEqual(['things', 'page', 2]);
    expect(things.keys.one('abc')).toEqual(['things', 'one', 'abc']);
  });

  it('should ask for a page with the order of the resource and the page size of the screens', async () => {
    fetchMock.mockResolvedValue(json(200, { items: [{ id: '1', name: 'A' }], total: 1 }));

    const result = await things.api.page(0);

    expect(fetchMock.mock.calls[0][0]).toBe('/api/things?limit=20&offset=0&orderBy=name&orderDirection=asc');
    expect(result).toEqual({ items: [{ id: '1', name: 'A' }], total: 1 });
  });

  it('should skip the records of the pages before', async () => {
    fetchMock.mockResolvedValue(json(200, { items: [], total: 45 }));

    await things.api.page(2);

    expect(fetchMock.mock.calls[0][0]).toBe('/api/things?limit=20&offset=40&orderBy=name&orderDirection=asc');
  });

  it('should sort in the direction of the resource', async () => {
    const newest = createResource<Thing, { name: string }, { name?: string }>({ key: 'newest', path: '/newest', orderBy: 'createdAt', orderDirection: 'desc' });
    fetchMock.mockResolvedValue(json(200, { items: [], total: 0 }));

    await newest.api.page(0);

    expect(fetchMock.mock.calls[0][0]).toBe('/api/newest?limit=20&offset=0&orderBy=createdAt&orderDirection=desc');
  });

  it('should create with POST and the body', async () => {
    fetchMock.mockResolvedValue(json(201, { id: '2', name: 'B' }));

    await things.api.create({ name: 'B' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/things');
    expect(init?.method).toBe('POST');
    expect(JSON.parse(init?.body as string)).toEqual({ name: 'B' });
  });

  it('should read one record by its id', async () => {
    fetchMock.mockResolvedValue(json(200, { id: 'abc', name: 'A' }));

    await expect(things.api.get('abc')).resolves.toEqual({ id: 'abc', name: 'A' });

    expect(fetchMock.mock.calls[0][0]).toBe('/api/things/abc');
  });

  it('should update with PATCH on the id of the record', async () => {
    fetchMock.mockResolvedValue(json(200, { id: 'abc', name: 'C' }));

    await things.api.update('abc', { name: 'C' });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/things/abc');
    expect(init?.method).toBe('PATCH');
    expect(JSON.parse(init?.body as string)).toEqual({ name: 'C' });
  });

  it('should delete with DELETE on the id of the record', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await expect(things.api.remove('abc')).resolves.toBeUndefined();

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/things/abc');
    expect(init?.method).toBe('DELETE');
  });

  it('should encode the id, so it cannot change the path', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    await things.api.remove('a/b?c');

    expect(fetchMock.mock.calls[0][0]).toBe('/api/things/a%2Fb%3Fc');
  });

  it('should let the error of the API through', async () => {
    fetchMock.mockResolvedValue(json(409, { message: 'Resource already exists', code: 'CONFLICT' }));

    await expect(things.api.create({ name: 'B' })).rejects.toMatchObject({ status: 409, code: 'CONFLICT' });
  });
});
