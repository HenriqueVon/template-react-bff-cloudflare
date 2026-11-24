import { describe, expect, it } from 'vitest';
import { ALLOWED_ROUTES } from '../../server/routes';

// The real table of routes of the project. The proxy itself is tested in proxy.spec.ts with routes of its own.
function methodsOf(path: string): string[] | undefined {
  return ALLOWED_ROUTES.find((route) => route.path.test(path))?.methods;
}

describe('the routes the proxy forwards', () => {
  it('should let the session check be read and nothing else', () => {
    expect(methodsOf('auth/me')).toEqual(['GET']);
  });

  it('should not forward the session routes, which have their own functions', () => {
    for (const path of ['auth/login', 'auth/refresh', 'auth/logout', 'auth/logout-all', 'auth/exchange', 'auth/exchange-code', 'auth/google/start']) {
      expect(methodsOf(path), path).toBeUndefined();
    }
  });

  it('should never accept PUT, which the API does not define, or a method the route does not need', () => {
    for (const route of ALLOWED_ROUTES) {
      expect(route.methods, String(route.path)).not.toContain('PUT');
      expect(route.methods.length, String(route.path)).toBeGreaterThan(0);
      for (const method of route.methods) expect(['GET', 'POST', 'PATCH', 'DELETE']).toContain(method);
    }
  });

  it('should anchor every path, so a longer path cannot match', () => {
    for (const route of ALLOWED_ROUTES) {
      expect(route.path.source.startsWith('^'), String(route.path)).toBe(true);
      expect(route.path.source.endsWith('$'), String(route.path)).toBe(true);
    }
  });

  // @template:example:start
  it('should let the example collection be listed and created, and a record be read, edited and deleted', () => {
    expect(methodsOf('examples')).toEqual(['GET', 'POST']);
    expect(methodsOf('examples/abc123')).toEqual(['GET', 'PATCH', 'DELETE']);
    expect(methodsOf('examples/abc123/items')).toBeUndefined();
  });
  // @template:example:end
});
