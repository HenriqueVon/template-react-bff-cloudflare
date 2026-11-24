import { describe, expect, it } from 'vitest';
import { parseCallback } from './callback';

describe('parseCallback', () => {
  it('should read the code and the state of a successful login', () => {
    expect(parseCallback('?code=placeholder-code&state=placeholder-state')).toEqual({
      kind  : 'code',
      code  : 'placeholder-code',
      state : 'placeholder-state',
    });
  });

  it('should report an empty page when someone opens the callback by hand', () => {
    expect(parseCallback('')).toEqual({ kind: 'empty' });
  });

  it.each([
    ['an error from the sign-in service', '?error=access_denied&state=placeholder-state'],
    ['an error together with a code', '?error=access_denied&code=placeholder-code&state=placeholder-state'],
    ['a code without a state', '?code=placeholder-code'],
    ['a state without a code', '?state=placeholder-state'],
    ['a code that is too long', `?code=${'a'.repeat(257)}&state=placeholder-state`],
    ['a state that is too long', `?code=placeholder-code&state=${'a'.repeat(513)}`],
  ])('should report a failed login for %s', (_name, search) => {
    expect(parseCallback(search)).toEqual({ kind: 'failed' });
  });
});
