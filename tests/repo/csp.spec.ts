// The Content-Security-Policy of public/_headers, directive by directive. The app needs nothing but its own files:
// no inline script, no inline style in the markup, no data: image and no other host. React sets the styles it
// needs (the spinner size, the indent of a category) through the style API of the DOM, which the policy allows,
// so `style-src` does not need 'unsafe-inline'. Do not loosen a directive to make a change pass; report it instead.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = fileURLToPath(new URL('../..', import.meta.url));

function directives(): Map<string, string> {
  const headers = readFileSync(`${root}public/_headers`, 'utf8');
  const csp = /Content-Security-Policy:\s*(.+)/.exec(headers)?.[1] ?? '';

  return new Map(csp.split(';').map((part) => {
    const [name, ...values] = part.trim().split(/\s+/);
    return [name, values.join(' ')] as const;
  }));
}

describe('Content-Security-Policy', () => {
  it('should be set, and fall back to the own origin', () => {
    expect(directives().get('default-src')).toBe("'self'");
  });

  it('should allow scripts and styles from the own origin only', () => {
    expect(directives().get('script-src')).toBe("'self'");
    expect(directives().get('style-src')).toBe("'self'");
  });

  it('should allow images, fonts and requests from the own origin only', () => {
    expect(directives().get('img-src')).toBe("'self'");
    expect(directives().get('font-src')).toBe("'self'");
    expect(directives().get('connect-src')).toBe("'self'");
  });

  it('should forbid plugins, a different base address and framing', () => {
    expect(directives().get('object-src')).toBe("'none'");
    expect(directives().get('base-uri')).toBe("'self'");
    expect(directives().get('form-action')).toBe("'self'");
    expect(directives().get('frame-ancestors')).toBe("'none'");
  });

  it('should never allow unsafe-inline, unsafe-eval or a wildcard in any directive', () => {
    for (const [name, value] of directives()) {
      expect(value, name).not.toContain('unsafe-inline');
      expect(value, name).not.toContain('unsafe-eval');
      expect(value, name).not.toMatch(/(^|\s)(\*|https?:|data:|blob:)(\s|$)/);
    }
  });

  it('should find no inline script, inline style or external host in the page of the app', () => {
    const page = readFileSync(`${root}index.html`, 'utf8');

    expect(page).not.toMatch(/<script(?![^>]*\ssrc=)/);
    expect(page).not.toMatch(/<style/i);
    expect(page).not.toMatch(/\sstyle=/i);
    expect(page).not.toMatch(/\son[a-z]+=/i);
    expect(page).not.toMatch(/(src|href)=["']https?:/i);
  });
});
