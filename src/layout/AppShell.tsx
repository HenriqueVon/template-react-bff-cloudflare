import { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router';
import { APP_NAME } from '@/app-info';
import { useT } from '@/i18n/i18n-context';
import { BottomNav } from './BottomNav';
import { sectionOf } from './nav-items';
import { SideNav } from './SideNav';
import { TopBar } from './TopBar';

// The frame of every screen after the login: side menu on the desktop, bottom menu on the phone, top bar with the user
// menu. It sits inside RequireAuth.
export function AppShell() {
  const t = useT();
  const { pathname } = useLocation();
  const section = sectionOf(pathname);
  const label = section ? t(section.labelKey) : undefined;

  useEffect(() => {
    document.title = label ? `${label} · ${APP_NAME}` : APP_NAME;
  }, [label]);

  return (
    <>
      <a href="#content" className="sr-only z-50 rounded-lg bg-surface-container-lowest px-4 py-2 text-label-md text-primary focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        {t('shell.skipToContent')}
      </a>
      <div className="flex min-h-screen bg-background text-on-background">
        <SideNav />
        <div className="flex min-h-screen w-full min-w-0 flex-1 flex-col md:ml-sidebar">
          <TopBar />
          <main id="content" tabIndex={-1} className="flex-1 p-margin-mobile pb-24 outline-none md:p-margin-desktop md:pb-margin-desktop">
            <div className="mx-auto w-full max-w-7xl">
              <Outlet />
            </div>
          </main>
        </div>
        <BottomNav />
      </div>
    </>
  );
}
