// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/i18n/test-render';
import { describe, expect, it, vi } from 'vitest';
import { SCREEN_PAGE_SIZE } from '@/api/pagination';
import { Pagination } from './Pagination';

describe('Pagination', () => {
  it('should say which records are shown and on which page', () => {
    render(<Pagination page={1} total={45} onPage={vi.fn()} />);

    expect(screen.getByText(`${SCREEN_PAGE_SIZE + 1}–40 of 45 records`)).toBeTruthy();
    expect(screen.getByText('Page 2 of 3')).toBeTruthy();
  });

  it('should not go before the first page or past the last', () => {
    const { rerender } = render(<Pagination page={0} total={45} onPage={vi.fn()} />);
    expect((screen.getByRole('button', { name: /Previous/ }) as HTMLButtonElement).disabled).toBe(true);

    rerender(<Pagination page={2} total={45} onPage={vi.fn()} />);
    expect((screen.getByRole('button', { name: /Next/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('41–45 of 45 records')).toBeTruthy();
  });

  it('should ask for the neighboring pages', async () => {
    const onPage = vi.fn();
    render(<Pagination page={1} total={45} onPage={onPage} />);

    await userEvent.click(screen.getByRole('button', { name: /Previous/ }));
    await userEvent.click(screen.getByRole('button', { name: /Next/ }));

    expect(onPage).toHaveBeenNthCalledWith(1, 0);
    expect(onPage).toHaveBeenNthCalledWith(2, 2);
  });

  it('should not let the user skip a page while the next one loads', () => {
    render(<Pagination page={1} total={45} onPage={vi.fn()} busy />);

    expect((screen.getByRole('button', { name: /Previous/ }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: /Next/ }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('should use the singular for one record', () => {
    render(<Pagination page={0} total={1} onPage={vi.fn()} />);

    expect(screen.getByText('1–1 of 1 record')).toBeTruthy();
  });

  it('should show one empty page when there is nothing', () => {
    render(<Pagination page={0} total={0} onPage={vi.fn()} />);

    expect(screen.getByText('0–0 of 0 records')).toBeTruthy();
    expect(screen.getByText('Page 1 of 1')).toBeTruthy();
  });
});
