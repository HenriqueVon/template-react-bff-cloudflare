// @vitest-environment jsdom
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Example } from '@/api/examples';
import { ToastProvider } from '@/components/ToastProvider';
import { render } from '@/i18n/test-render';
import { ExamplesPage } from './ExamplesPage';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function example(index: number, extra: Partial<Example> = {}): Example {
  return {
    id          : `example-${index}`,
    name        : `Example ${index}`,
    description : null,
    createdAt   : '2026-01-15T12:00:00.000Z',
    updatedAt   : '2026-01-15T12:00:00.000Z',
    ...extra,
  };
}

// A small API in memory, behind fetch: the page talks to /api/examples like it does in the browser.
function fakeApi(initial: Example[]) {
  const records = [...initial];
  const calls: { method: string; url: string; body?: unknown }[] = [];

  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    calls.push({ method, url: `${url.pathname}${url.search}`, body });

    const id = url.pathname.split('/')[3];

    if (method === 'GET') {
      const limit = Number(url.searchParams.get('limit'));
      const offset = Number(url.searchParams.get('offset'));
      return json(200, { items: records.slice(offset, offset + limit), total: records.length });
    }

    if (method === 'POST') {
      if (records.some((record) => record.name.toLowerCase() === body.name.toLowerCase())) return json(409, { message: 'Example name already exists!', code: 'CONFLICT' });
      const created = example(records.length + 1, { name: body.name, description: body.description ?? null });
      records.push(created);
      return json(201, created);
    }

    if (method === 'PATCH') {
      const record = records.find((item) => item.id === id) as Example;
      Object.assign(record, body);
      return json(200, record);
    }

    records.splice(records.findIndex((item) => item.id === id), 1);
    return new Response(null, { status: 204 });
  });

  vi.stubGlobal('fetch', fetchMock);

  return { calls, records };
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  render(
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ExamplesPage />
      </ToastProvider>
    </QueryClientProvider>,
  );
}

describe('ExamplesPage', () => {
  beforeEach(() => {
    // The table is the view of a wide screen, and jsdom has no media queries.
    window.localStorage.setItem('my-web-app:list-view', 'table');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should list the records of the first page, with the order and the page size of the API', async () => {
    const api = fakeApi([example(1), example(2, { description: 'The second one' })]);

    renderPage();

    expect(await screen.findByText('Example 2')).toBeTruthy();
    expect(screen.getByText('The second one')).toBeTruthy();
    expect(api.calls[0].url).toBe('/api/examples?limit=20&offset=0&orderBy=createdAt&orderDirection=asc');
    expect(screen.getByText('1–2 of 2 records')).toBeTruthy();
  });

  it('should say what to do when there is nothing yet', async () => {
    fakeApi([]);

    renderPage();

    expect(await screen.findByText('No examples yet')).toBeTruthy();
  });

  it('should say when the list could not be loaded, and try again', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(json(500, { message: 'Boom' }))
      .mockResolvedValueOnce(json(200, { items: [example(1)], total: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    renderPage();

    expect(await screen.findByText('The data could not be loaded')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain('The server had an unexpected error');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Example 1')).toBeTruthy();
  });

  it('should show the next page when the user asks for it', async () => {
    const records = Array.from({ length: 25 }, (_, index) => example(index + 1));
    const api = fakeApi(records);

    renderPage();
    await screen.findByText('Example 1');
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));

    expect(await screen.findByText('Example 21')).toBeTruthy();
    expect(api.calls.at(-1)?.url).toBe('/api/examples?limit=20&offset=20&orderBy=createdAt&orderDirection=asc');
    expect(screen.getByText('Page 2 of 2')).toBeTruthy();
  });

  describe('create', () => {
    it('should check the fields before calling the API, and put the focus on the first one with an error', async () => {
      const api = fakeApi([example(1)]);
      renderPage();
      await screen.findByText('Example 1');

      await userEvent.click(screen.getByRole('button', { name: 'New example' }));
      const dialog = screen.getByRole('dialog', { name: 'New example' });
      await userEvent.type(within(dialog).getByLabelText('Name'), 'ab');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      expect(within(dialog).getByText('The name must have at least 3 characters.')).toBeTruthy();
      await waitFor(() => expect(document.activeElement).toBe(within(dialog).getByLabelText('Name')));
      expect(api.calls.filter((call) => call.method === 'POST')).toEqual([]);
    });

    it('should send the record, close the dialog, show a message and reload the list', async () => {
      const api = fakeApi([example(1)]);
      renderPage();
      await screen.findByText('Example 1');

      await userEvent.click(screen.getByRole('button', { name: 'New example' }));
      const dialog = screen.getByRole('dialog', { name: 'New example' });
      await userEvent.type(within(dialog).getByLabelText('Name'), '  Brand new  ');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      expect(await screen.findByText('Example created.')).toBeTruthy();
      expect(api.calls.find((call) => call.method === 'POST')?.body).toEqual({ name: 'Brand new', description: null });
      expect(await screen.findByText('Brand new')).toBeTruthy();
      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('should explain a name that already exists, and keep the dialog open', async () => {
      fakeApi([example(1)]);
      renderPage();
      await screen.findByText('Example 1');

      await userEvent.click(screen.getByRole('button', { name: 'New example' }));
      const dialog = screen.getByRole('dialog', { name: 'New example' });
      await userEvent.type(within(dialog).getByLabelText('Name'), 'example 1');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      expect((await within(dialog).findByRole('alert')).textContent).toBe('An example with this name already exists.');
    });
  });

  describe('edit', () => {
    it('should send only the fields that changed', async () => {
      const api = fakeApi([example(1, { description: 'Original' })]);
      renderPage();
      await screen.findByText('Example 1');

      await userEvent.click(screen.getByRole('button', { name: 'Edit Example 1' }));
      const dialog = screen.getByRole('dialog', { name: 'Edit example' });
      const description = within(dialog).getByLabelText('Description');
      await userEvent.clear(description);
      await userEvent.type(description, 'Changed');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Save' }));

      expect(await screen.findByText('Example updated.')).toBeTruthy();
      expect(api.calls.find((call) => call.method === 'PATCH')).toMatchObject({ url: '/api/examples/example-1', body: { description: 'Changed' } });
    });

    it('should not call the API when nothing changed', async () => {
      const api = fakeApi([example(1)]);
      renderPage();
      await screen.findByText('Example 1');

      await userEvent.click(screen.getByRole('button', { name: 'Edit Example 1' }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));

      expect(await screen.findByText('Example updated.')).toBeTruthy();
      expect(api.calls.filter((call) => call.method === 'PATCH')).toEqual([]);
    });

    it('should clear the description when it is emptied', async () => {
      const api = fakeApi([example(1, { description: 'Original' })]);
      renderPage();
      await screen.findByText('Example 1');

      await userEvent.click(screen.getByRole('button', { name: 'Edit Example 1' }));
      await userEvent.clear(within(screen.getByRole('dialog')).getByLabelText('Description'));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Save' }));

      await screen.findByText('Example updated.');
      expect(api.calls.find((call) => call.method === 'PATCH')?.body).toEqual({ description: null });
    });
  });

  describe('delete', () => {
    it('should say what will be deleted, and delete only after the confirmation', async () => {
      const api = fakeApi([example(1), example(2)]);
      renderPage();
      await screen.findByText('Example 2');

      await userEvent.click(screen.getByRole('button', { name: 'Delete Example 2' }));
      const dialog = screen.getByRole('dialog', { name: 'Delete example' });
      expect(within(dialog).getByText('Example 2')).toBeTruthy();
      expect(api.calls.filter((call) => call.method === 'DELETE')).toEqual([]);

      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

      expect(await screen.findByText('Example deleted.')).toBeTruthy();
      expect(api.calls.find((call) => call.method === 'DELETE')?.url).toBe('/api/examples/example-2');
      await waitFor(() => expect(screen.queryByText('Example 2')).toBeNull());
    });

    it('should go back one page when the last record of the last page is deleted', async () => {
      const records = Array.from({ length: 21 }, (_, index) => example(index + 1));
      fakeApi(records);
      renderPage();
      await screen.findByText('Example 1');
      await userEvent.click(screen.getByRole('button', { name: /Next/ }));
      await screen.findByText('Example 21');

      await userEvent.click(screen.getByRole('button', { name: 'Delete Example 21' }));
      await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));

      expect(await screen.findByText('Page 1 of 1')).toBeTruthy();
      expect(await screen.findByText('Example 20')).toBeTruthy();
    });
  });
});
