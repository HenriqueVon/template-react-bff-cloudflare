// Small values kept in this browser. Storage can be unavailable (private mode, blocked site data), so every access is
// guarded and the app works without it. Never store tokens, secrets or personal data here
// (docs/SECURITY.md). The keys start with the name of the project; `npm run init` sets it.
const LAST_ACTIVITY_KEY = 'my-web-app:last-activity';
// @template:login-google:start
const RETURN_PATH_KEY = 'my-web-app:return-path';
// @template:login-google:end

// Time of the last interaction in any tab, in milliseconds, shared so that activity in one tab keeps the others
// signed in.
export function readLastActivity(): number | null {
  try {
    const value = Number(window.localStorage.getItem(LAST_ACTIVITY_KEY));
    return Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function saveLastActivity(at: number): void {
  try {
    window.localStorage.setItem(LAST_ACTIVITY_KEY, String(at));
  } catch {
    // Not shared; each tab then counts its own activity.
  }
}

// How the lists are shown: a table or cards. The user's choice, for every list.
export type ListViewMode = 'table' | 'cards';
const LIST_VIEW_KEY = 'my-web-app:list-view';

export function readListView(): ListViewMode | null {
  try {
    const value = window.localStorage.getItem(LIST_VIEW_KEY);
    return value === 'table' || value === 'cards' ? value : null;
  } catch {
    return null;
  }
}

export function saveListView(mode: ListViewMode): void {
  try {
    window.localStorage.setItem(LIST_VIEW_KEY, mode);
  } catch {
    // Not saved; the lists then follow the width of the screen.
  }
}

// @template:login-google:start
// The page the user wanted before the login. It survives the trip to Google in this tab only.
export function saveReturnPath(path: string): void {
  try {
    window.sessionStorage.setItem(RETURN_PATH_KEY, path);
  } catch {
    // The user then lands on the home page after the login.
  }
}

export function takeReturnPath(): string | null {
  try {
    const value = window.sessionStorage.getItem(RETURN_PATH_KEY);
    window.sessionStorage.removeItem(RETURN_PATH_KEY);
    return value;
  } catch {
    return null;
  }
}
// @template:login-google:end

// The language of the interface. Only the code of the language, which is not personal data.
export const LANGUAGE_KEY = 'my-web-app:language';

export function readLanguage(): string | null {
  try {
    return window.localStorage.getItem(LANGUAGE_KEY);
  } catch {
    return null;
  }
}

export function saveLanguage(language: string): void {
  try {
    window.localStorage.setItem(LANGUAGE_KEY, language);
  } catch {
    // Not saved; the app then follows the language of the browser.
  }
}
