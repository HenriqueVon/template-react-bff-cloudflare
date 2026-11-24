import { useEffect, useRef, useState } from 'react';
import { LogOut, MonitorSmartphone, User as UserIcon } from 'lucide-react';
import { useAuth, useUser } from '@/auth/auth-context';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { useT } from '@/i18n/i18n-context';
import { LanguageSwitch } from '@/i18n/LanguageSwitch';
import { errorMessage } from '@/lib/errors';

// The user menu: who is signed in, the language and the two ways to leave.
export function UserMenu() {
  const t = useT();
  const user = useUser();
  const { logout, logoutAll } = useAuth();
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  async function handleLogoutAll() {
    setPending(true);
    setError(null);

    try {
      await logoutAll();
    } catch (failure) {
      setError(errorMessage(failure, t));
      setPending(false);
    }
  }

  const itemClass = 'flex w-full items-center gap-2 px-4 py-2.5 text-left text-label-md text-on-surface transition-colors hover:bg-surface-container';

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={t('user.menu')}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 w-9 items-center justify-center rounded-full border border-outline-variant/40 bg-surface-container-high text-on-surface-variant transition-colors hover:bg-surface-container-highest"
      >
        <UserIcon size={18} aria-hidden="true" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 z-40 mt-2 w-64 overflow-hidden rounded-xl border border-outline-variant/40 bg-surface-container-lowest py-1 shadow-lg">
          <div className="border-b border-outline-variant/30 px-4 pb-2 pt-2">
            <p className="truncate text-label-md text-on-surface">{user.name}</p>
            <p className="truncate text-label-sm text-on-surface-variant">{user.email}</p>
          </div>
          <div className="border-b border-outline-variant/30 px-3 py-2">
            <LanguageSwitch />
          </div>
          <button type="button" role="menuitem" className={itemClass} onClick={() => void logout()}>
            <LogOut size={18} aria-hidden="true" />
            {t('user.signOut')}
          </button>
          <button
            type="button"
            role="menuitem"
            className={itemClass}
            onClick={() => {
              setOpen(false);
              setConfirming(true);
            }}
          >
            <MonitorSmartphone size={18} aria-hidden="true" />
            {t('user.signOutAll')}
          </button>
        </div>
      )}

      {confirming && (
        <ConfirmDialog
          title={t('user.signOutAll')}
          confirmLabel={t('user.signOutAllConfirm')}
          danger
          pending={pending}
          error={error}
          onConfirm={() => void handleLogoutAll()}
          onCancel={() => {
            setConfirming(false);
            setError(null);
          }}
        >
          {t('user.signOutAllBody')}
        </ConfirmDialog>
      )}
    </div>
  );
}
