// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Pagination } from '@/components/Pagination';
import { LanguageSwitch } from './LanguageSwitch';
import { render } from './test-render';

describe('LanguageSwitch', () => {
  it('should offer the two languages and show the current one', () => {
    render(<LanguageSwitch />);

    const select = screen.getByLabelText('Language') as HTMLSelectElement;

    expect(select.value).toBe('en');
    expect([...select.options].map((option) => option.textContent)).toEqual(['English', 'Português']);
  });

  it('should change the text of the screen at once, keep the choice and set the language of the page', async () => {
    render(
      <>
        <LanguageSwitch />
        <Pagination page={0} total={45} onPage={() => undefined} />
      </>,
    );

    expect(screen.getByText('Page 1 of 3')).toBeTruthy();
    await userEvent.selectOptions(screen.getByLabelText('Language'), 'pt-BR');

    expect(screen.getByText('Página 1 de 3')).toBeTruthy();
    expect(screen.getByLabelText('Idioma')).toBeTruthy();
    expect(window.localStorage.getItem('my-web-app:language')).toBe('pt-BR');
    expect(document.documentElement.lang).toBe('pt-BR');
  });

  it('should start in the language saved in this browser', () => {
    window.localStorage.setItem('my-web-app:language', 'pt-BR');

    render(<LanguageSwitch />);

    expect((screen.getByLabelText('Idioma') as HTMLSelectElement).value).toBe('pt-BR');
  });
});
