export const CALLBACK_PATH = '/auth/callback';

// What the sign-in service put on the redirect URL after Google. 'error' is also used when the login is
// refused (cancelled, no access); the reason is never shown to the user.
export type CallbackParams =
  | { kind: 'empty' }
  | { kind: 'failed' }
  | { kind: 'code'; code: string; state: string };

const MAX_CODE_LENGTH = 256;
const MAX_STATE_LENGTH = 512;

export function parseCallback(search: string): CallbackParams {
  const params = new URLSearchParams(search);
  const code = params.get('code');
  const state = params.get('state');

  if (!code && !state && !params.has('error')) return { kind: 'empty' };

  if (params.has('error') || !code || !state || code.length > MAX_CODE_LENGTH || state.length > MAX_STATE_LENGTH) {
    return { kind: 'failed' };
  }

  return { kind: 'code', code, state };
}
