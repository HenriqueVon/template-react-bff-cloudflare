import { describe, expect, it } from 'vitest';
import { challengeOf, generateState, generateVerifier, safeEqual } from '../../server/pkce';

describe('pkce', () => {
  it('should generate a verifier of 43 URL-safe characters, different each time', () => {
    const first = generateVerifier();

    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(generateVerifier()).not.toBe(first);
  });

  it('should generate a state of 22 URL-safe characters, different each time', () => {
    const first = generateState();

    expect(first).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(generateState()).not.toBe(first);
  });

  it('should derive the challenge as defined in RFC 7636, appendix B', async () => {
    expect(await challengeOf('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  describe('safeEqual', () => {
    it('should accept equal strings', () => {
      expect(safeEqual('abc-123', 'abc-123')).toBe(true);
    });

    it.each([
      ['a different character', 'abc-123', 'abc-124'],
      ['a different length', 'abc-123', 'abc-1234'],
      ['an empty string', 'abc-123', ''],
    ])('should refuse %s', (_name, a, b) => {
      expect(safeEqual(a, b)).toBe(false);
    });
  });
});
