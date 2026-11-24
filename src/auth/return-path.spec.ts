import { describe, expect, it } from 'vitest';
import { safeReturnPath } from './return-path';

describe('safeReturnPath', () => {
  it.each([
    '/',
    '/transactions',
    '/transactions?page=2',
    '/financial/funds#top',
  ])('should accept the path of this app: %s', (path) => {
    expect(safeReturnPath(path)).toBe(path);
  });

  it.each([
    ['nothing', undefined],
    ['null', null],
    ['an empty string', ''],
    ['another site', 'https://evil.example/path'],
    ['a protocol-relative URL', '//evil.example/path'],
    ['a javascript URL', 'javascript:alert(1)'],
    ['a relative path', 'transactions'],
    ['a backslash trick', '/\\evil.example'],
    ['a control character', '/path\u0001'],
    ['a line break', '/path\nSet-Cookie: x=1'],
    ['the login page', '/login'],
    ['the callback page', '/auth/callback?code=x&state=y'],
  ])('should fall back to the home page for %s', (_name, path) => {
    expect(safeReturnPath(path)).toBe('/');
  });
});
