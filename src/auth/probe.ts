import { apiRequest, ApiError } from '@/api/client';
import type { User } from './auth-context';

// What the first data call says about the session.
export type SessionProbe =
  | { status: 'authenticated'; user: User }
  | { status: 'anonymous' }
  // The session is valid but the user has no access to this app.
  | { status: 'forbidden'; code?: string }
  // A temporary failure: 429, 503, a network error. The session is not over.
  | { status: 'unavailable'; error: unknown };

// Asks the API who is signed in. apiRequest renews an expired token by itself; a 401 that survives it means there is no
// session. An API without such an endpoint can use its cheapest authenticated call instead: only the answer's status
// matters here, and `user` is what the shell shows.
export async function probeSession(): Promise<SessionProbe> {
  try {
    const user = await apiRequest<User>('/auth/me');
    return { status: 'authenticated', user };
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 401) return { status: 'anonymous' };
      if (error.status === 403) return { status: 'forbidden', code: error.code };
    }

    return { status: 'unavailable', error };
  }
}
