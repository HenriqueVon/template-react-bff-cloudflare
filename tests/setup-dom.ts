import { afterEach, beforeEach } from 'vitest';
import { LANGUAGE_KEY } from '../src/lib/storage';

// Runs before every test file, in node too, so it only touches the DOM when there is one. A component test renders into
// the document, and each test must start with an empty one.
afterEach(async () => {
  if (typeof document === 'undefined') return;

  const { cleanup } = await import('@testing-library/react');
  cleanup();
});

// The tests read the texts in English; a test that wants another language saves it itself before rendering.
beforeEach(() => {
  if (typeof window !== 'undefined') window.localStorage.setItem(LANGUAGE_KEY, 'en');
});

// jsdom does not implement the methods of the native <dialog> that the Modal uses. This is the behavior the Modal relies
// on: showModal opens it, close closes it.
if (typeof HTMLDialogElement !== 'undefined') {
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
}
