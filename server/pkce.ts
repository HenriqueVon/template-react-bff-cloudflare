// PKCE (RFC 7636) and state for the Google login. They are created here, in the Functions, and kept
// in an HttpOnly cookie: the verifier never reaches JavaScript.

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomToken(byteLength: number): string {
  return base64url(crypto.getRandomValues(new Uint8Array(byteLength)));
}

// 32 random bytes: 43 characters, the minimum length of a verifier.
export function generateVerifier(): string {
  return randomToken(32);
}

// 16 random bytes: 22 characters. Returned unchanged on the redirect and compared before the exchange.
export function generateState(): string {
  return randomToken(16);
}

// code_challenge = base64url(SHA-256(code_verifier)), method S256.
export async function challengeOf(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));

  return base64url(new Uint8Array(digest));
}

// Compares two strings without stopping at the first difference.
export function safeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);

  let difference = left.length ^ right.length;
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }

  return difference === 0;
}
