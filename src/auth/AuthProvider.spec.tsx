// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiRequest } from '@/api/client';
import { render } from '@/i18n/test-render';
import { useAuth } from './auth-context';
import { AuthProvider } from './AuthProvider';

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const user = { id: 'user-1', name: 'Example Person', email: 'person@example.com' };

// Shows what the provider knows and gives a button to each thing a screen can ask of it.
function Probe() {
  const auth = useAuth();
  const { state } = auth;

  return (
    <div>
      <p data-testid="status">{state.status}</p>
      {state.status === 'authenticated' && <p>{state.user.name}</p>}
      {state.status === 'anonymous' && <p data-testid="notice">{state.notice ?? 'none'}</p>}
      {state.status === 'forbidden' && <p data-testid="code">{state.code}</p>}
      <button type="button" onClick={() => void auth.logout()}>logout</button>
      <button type="button" onClick={() => auth.logoutAll().catch(() => undefined)}>logout-all</button>
      <button type="button" onClick={auth.retry}>retry</button>
      <button type="button" onClick={() => void apiRequest('/examples').catch(() => undefined)}>call</button>
      {/* @template:login-password:start */}
      <button type="button" onClick={() => auth.login('person@example.com', 'placeholder-password').catch(() => undefined)}>login</button>
      {/* @template:login-password:end */}
      {/* @template:login-google:start */}
      <button type="button" onClick={() => void auth.completeLogin('placeholder-code', 'placeholder-state')}>complete</button>
      <button type="button" onClick={() => auth.failLogin()}>fail</button>
      {/* @template:login-google:end */}
    </div>
  );
}

function renderProvider() {
  const queryClient = new QueryClient();

  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

// The routes of the BFF, by method and path, with the answer of each. An unknown route fails the test.
function routes(table: Record<string, () => Response | Promise<Response>>) {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(String(input), 'http://localhost');
    const handler = table[`${init?.method ?? 'GET'} ${url.pathname}`];
    if (!handler) throw new Error(`Unexpected call: ${init?.method ?? 'GET'} ${url.pathname}`);

    return handler();
  });
  vi.stubGlobal('fetch', fetchMock);

  return fetchMock;
}

describe('AuthProvider', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.pushState(null, '', '/');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('should check the session when the app opens, and know the user', async () => {
    routes({ 'GET /api/auth/me': () => json(200, user) });

    renderProvider();

    expect(screen.getByTestId('status').textContent).toBe('loading');
    expect(await screen.findByText('Example Person')).toBeTruthy();
    expect(screen.getByTestId('status').textContent).toBe('authenticated');
  });

  it('should be anonymous, with no message, when there is no session', async () => {
    routes({
      'GET /api/auth/me'      : () => json(401, { code: 'AUTH_TOKEN_EXPIRED' }),
      'POST /api/auth/refresh' : () => json(401, { code: 'AUTH_SESSION_MISSING' }),
    });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
    expect(screen.getByTestId('notice').textContent).toBe('none');
  });

  it('should tell apart a user with no access', async () => {
    routes({ 'GET /api/auth/me': () => json(403, { code: 'FORBIDDEN' }) });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('forbidden'));
    expect(screen.getByTestId('code').textContent).toBe('FORBIDDEN');
  });

  it('should keep the user signed in when the API is down, and check again on retry', async () => {
    let up = false;
    routes({ 'GET /api/auth/me': () => (up ? json(200, user) : json(503, { code: 'API_UNAVAILABLE' })) });

    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('unavailable'));

    up = true;
    await userEvent.click(screen.getByRole('button', { name: 'retry' }));

    expect(await screen.findByText('Example Person')).toBeTruthy();
  });

  it('should not bring a session back after the idle time, even when the cookies are still valid', async () => {
    window.localStorage.setItem('my-web-app:last-activity', String(Date.now() - 31 * 60_000));
    const fetchMock = routes({
      'GET /api/auth/me'   : () => json(200, user),
      'POST /api/auth/logout' : () => new Response(null, { status: 204 }),
    });

    renderProvider();

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
    expect(screen.getByTestId('notice').textContent).toBe('idle');
    expect(fetchMock.mock.calls.some(([url, init]) => String(url) === '/api/auth/logout' && init?.method === 'POST')).toBe(true);
  });

  it('should end the session on a logout, with no message', async () => {
    routes({ 'GET /api/auth/me': () => json(200, user), 'POST /api/auth/logout': () => new Response(null, { status: 204 }) });
    renderProvider();
    await screen.findByText('Example Person');

    await userEvent.click(screen.getByRole('button', { name: 'logout' }));

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
    expect(screen.getByTestId('notice').textContent).toBe('none');
  });

  it('should keep the session when the logout from every device fails: the other sessions are still open', async () => {
    routes({ 'GET /api/auth/me': () => json(200, user), 'POST /api/auth/logout-all': () => json(503, { code: 'API_UNAVAILABLE' }) });
    renderProvider();
    await screen.findByText('Example Person');

    await userEvent.click(screen.getByRole('button', { name: 'logout-all' }));

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('authenticated'));
  });

  it('should say the session expired when a call finds it over while the app is open', async () => {
    routes({
      'GET /api/auth/me'      : () => json(200, user),
      'GET /api/examples'     : () => json(401, { code: 'AUTH_SESSION_REVOKED' }),
    });
    renderProvider();
    await screen.findByText('Example Person');

    await userEvent.click(screen.getByRole('button', { name: 'call' }));

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
    expect(screen.getByTestId('notice').textContent).toBe('expired');
  });

  // @template:login-password:start
  it('should start the session after a login, and clear what the last user had cached', async () => {
    let signedIn = false;
    routes({
      'GET /api/auth/me'      : () => (signedIn ? json(200, user) : json(401, { code: 'AUTH_SESSION_MISSING' })),
      'POST /api/auth/login'  : () => {
        signedIn = true;
        return json(200, { expiresIn: 900 });
      },
    });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));

    await userEvent.click(screen.getByRole('button', { name: 'login' }));

    expect(await screen.findByText('Example Person')).toBeTruthy();
  });

  it('should stay anonymous when the login is refused', async () => {
    routes({
      'GET /api/auth/me'     : () => json(401, { code: 'AUTH_SESSION_MISSING' }),
      'POST /api/auth/login' : () => json(401, { code: 'AUTH_INVALID_CREDENTIALS' }),
    });
    renderProvider();
    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));

    await userEvent.click(screen.getByRole('button', { name: 'login' }));

    await waitFor(() => expect(screen.getByTestId('status').textContent).toBe('anonymous'));
  });
  // @template:login-password:end

  // @template:login-google:start
  it('should not check the session on the callback page, where it does not exist yet', async () => {
    window.history.pushState(null, '', '/auth/callback?code=placeholder-code&state=placeholder-state');
    const fetchMock = routes({});

    renderProvider();

    expect(screen.getByTestId('status').textContent).toBe('anonymous');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should start the session after the code is exchanged', async () => {
    window.history.pushState(null, '', '/auth/callback');
    routes({
      'POST /api/auth/exchange' : () => json(200, { expiresIn: 900 }),
      'GET /api/auth/me'        : () => json(200, user),
    });
    renderProvider();

    await userEvent.click(screen.getByRole('button', { name: 'complete' }));

    expect(await screen.findByText('Example Person')).toBeTruthy();
  });

  it('should show a generic message when the exchange fails', async () => {
    window.history.pushState(null, '', '/auth/callback');
    routes({ 'POST /api/auth/exchange': () => json(401, { code: 'AUTH_CODE_INVALID' }) });
    renderProvider();

    await userEvent.click(screen.getByRole('button', { name: 'complete' }));

    await waitFor(() => expect(screen.getByTestId('notice').textContent).toBe('login_failed'));
  });
  // @template:login-google:end
});
