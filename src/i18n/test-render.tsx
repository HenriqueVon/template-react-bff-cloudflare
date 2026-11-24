import { render as renderWithTestingLibrary, type RenderOptions } from '@testing-library/react';
import type { ReactElement } from 'react';
import { I18nProvider } from './I18nProvider';

// `render` of Testing Library with the i18n provider around the component, in English (tests/setup-dom.ts saves it
// as the language before each test). A component test that wants English saves it before rendering.
export function render(ui: ReactElement, options?: RenderOptions) {
  return renderWithTestingLibrary(ui, { wrapper: I18nProvider, ...options });
}
