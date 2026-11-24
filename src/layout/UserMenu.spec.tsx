// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/api/client';
import { AuthContext, type AuthContextValue } from '@/auth/auth-context';
import { ToastProvider } from '@/components/ToastProvider';
import { render } from '@/i18n/test-render';
import { UserMenu } from './UserMenu';

const user = { id: 'user-1', name: 'Example Person', email: 'person@example.com' };

function renderMenu(logout: AuthContextValue['logout']) {
  const value: AuthContextValue = {
    state     : { status: 'authenticated', user },
    // @template:login-password:start
    login     : vi.fn(),
    // @template:login-password:end
    // @template:login-google:start
    startLogin    : vi.fn(),
    completeLogin : vi.fn(),
    failLogin     : vi.fn(),
    // @template:login-google:end
    retry     : vi.fn(),
    logout,
    logoutAll : vi.fn(),
  };

  render(
    <AuthContext.Provider value={value}>
      <ToastProvider>
        <UserMenu />
      </ToastProvider>
    </AuthContext.Provider>,
  );
}

describe('UserMenu', () => {
  it('should show who is signed in', async () => {
    renderMenu(vi.fn().mockResolvedValue(undefined));

    await userEvent.click(screen.getByRole('button', { name: 'User menu' }));

    expect(screen.getByText('Example Person')).toBeTruthy();
    expect(screen.getByText('person@example.com')).toBeTruthy();
  });

  it('should sign out', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    renderMenu(logout);

    await userEvent.click(screen.getByRole('button', { name: 'User menu' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    expect(logout).toHaveBeenCalledTimes(1);
  });

  it('should say so when the logout does not reach the server, instead of pretending the user left', async () => {
    const logout = vi.fn().mockRejectedValue(new ApiError(0, 'Network error', 'NETWORK_ERROR'));
    renderMenu(logout);

    await userEvent.click(screen.getByRole('button', { name: 'User menu' }));
    await userEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

    await waitFor(() => expect(screen.getByText('No connection to the server. Check your internet and try again.')).toBeTruthy());
    // The menu closes, and the user can try again.
    expect(screen.queryByRole('menu')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'User menu' }));
    expect(screen.getByRole('menuitem', { name: 'Sign out' })).toBeTruthy();
  });
});
