// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render } from '@/i18n/test-render';
import { MemoryRouter, Route, Routes } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
// @template:login-password:start
import { ApiError } from '@/api/client';
// @template:login-password:end
import { AuthContext, type AuthContextValue, type AuthState } from '@/auth/auth-context';
import { LoginPage } from './LoginPage';

const user = { id: 'user-1', name: 'Example Person', email: 'person@example.com' };

function renderLogin(state: AuthState, entry: string | { pathname: string; state: unknown } = '/login') {
  // @template:login-password:start
  const login = vi.fn<AuthContextValue['login']>();
  // @template:login-password:end
  // @template:login-google:start
  const startLogin = vi.fn();
  // @template:login-google:end
  const value: AuthContextValue = {
    state,
    // @template:login-password:start
    login,
    // @template:login-password:end
    // @template:login-google:start
    startLogin,
    completeLogin : vi.fn(),
    failLogin     : vi.fn(),
    // @template:login-google:end
    retry         : vi.fn(),
    logout        : vi.fn(),
    logoutAll     : vi.fn(),
  };

  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/examples" element={<p>Examples page</p>} />
          <Route path="/" element={<p>Home page</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  );

  return {
    // @template:login-password:start
    login,
    // @template:login-password:end
    // @template:login-google:start
    startLogin,
    // @template:login-google:end
  };
}

describe('LoginPage', () => {
  it('should show the name of the app', () => {
    renderLogin({ status: 'anonymous', notice: null });

    expect(screen.getByRole('heading', { name: 'My Web App' })).toBeTruthy();
  });

  it.each([
    ['expired', 'Your session has expired'],
    ['idle', 'inactivity'],
    ['login_failed', 'Could not sign in'],
  ] as const)('should say why the session ended (%s)', (notice, text) => {
    renderLogin({ status: 'anonymous', notice });

    expect(screen.getByRole('alert').textContent).toContain(text);
  });

  it('should show no message after a plain logout', () => {
    renderLogin({ status: 'anonymous', notice: null });

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('should wait while the session is being checked', () => {
    renderLogin({ status: 'loading' });

    expect(screen.queryByLabelText('Email')).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy();
  });

  it('should skip the login page when there is already a session', () => {
    renderLogin({ status: 'authenticated', user }, { pathname: '/login', state: { from: '/examples' } });

    expect(screen.getByText('Examples page')).toBeTruthy();
  });

  it('should not send the user to another site, whatever the address asks', () => {
    renderLogin({ status: 'authenticated', user }, { pathname: '/login', state: { from: '//example.com/phish' } });

    expect(screen.getByText('Home page')).toBeTruthy();
  });

  // @template:login-password:start
  describe('with an email and a password', () => {
    it('should send the credentials, without the spaces around the email', async () => {
      const { login } = renderLogin({ status: 'anonymous', notice: null });
      login.mockResolvedValue();

      await userEvent.type(screen.getByLabelText('Email'), '  person@example.com ');
      await userEvent.type(screen.getByLabelText('Password'), 'placeholder-password');
      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

      expect(login).toHaveBeenCalledWith('person@example.com', 'placeholder-password');
    });

    it('should not call the API without an email and a password', async () => {
      const { login } = renderLogin({ status: 'anonymous', notice: null });

      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

      expect(login).not.toHaveBeenCalled();
      expect(screen.getByRole('alert').textContent).toBe('Enter your email and your password.');
    });

    it('should say why the login was refused, by the code of the API', async () => {
      const { login } = renderLogin({ status: 'anonymous', notice: null });
      login.mockRejectedValue(new ApiError(401, 'Invalid email or password', 'AUTH_INVALID_CREDENTIALS'));

      await userEvent.type(screen.getByLabelText('Email'), 'person@example.com');
      await userEvent.type(screen.getByLabelText('Password'), 'wrong');
      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

      expect((await screen.findByRole('alert')).textContent).toBe('The email or the password is wrong.');
      expect((screen.getByRole('button', { name: 'Sign in' }) as HTMLButtonElement).disabled).toBe(false);
    });

    it('should say when to try again after too many attempts', async () => {
      const { login } = renderLogin({ status: 'anonymous', notice: null });
      login.mockRejectedValue(new ApiError(429, 'Too many attempts', 'RATE_LIMITED', 30));

      await userEvent.type(screen.getByLabelText('Email'), 'person@example.com');
      await userEvent.type(screen.getByLabelText('Password'), 'wrong');
      await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

      expect((await screen.findByRole('alert')).textContent).toBe('Too many attempts. Try again in 30 seconds.');
    });
  });
  // @template:login-password:end

  // @template:login-google:start
  describe('with Google', () => {
    it('should start the login for the home page by default', async () => {
      const { startLogin } = renderLogin({ status: 'anonymous', notice: null });

      await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));

      expect(startLogin).toHaveBeenCalledWith('/');
    });

    it('should send the user back to the page they wanted after the login', async () => {
      const { startLogin } = renderLogin({ status: 'anonymous', notice: null }, { pathname: '/login', state: { from: '/examples' } });

      await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));

      expect(startLogin).toHaveBeenCalledWith('/examples');
    });

    it('should not start the login for another site, whatever the address asks', async () => {
      const { startLogin } = renderLogin({ status: 'anonymous', notice: null }, { pathname: '/login', state: { from: '//example.com/phish' } });

      await userEvent.click(screen.getByRole('button', { name: 'Sign in with Google' }));

      expect(startLogin).toHaveBeenCalledWith('/');
    });
  });
  // @template:login-google:end
});
