import { useLocation } from 'react-router';
import { APP_NAME } from '@/app-info';
import { useT } from '@/i18n/i18n-context';
import { sectionOf } from './nav-items';
import { UserMenu } from './UserMenu';

export function TopBar() {
  const t = useT();
  const { pathname } = useLocation();
  const section = sectionOf(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between gap-4 border-b border-outline-variant/30 bg-surface px-margin-mobile md:px-8">
      {/* The page has its own <h1>; this is only a label of where you are. */}
      <p className="shrink-0 truncate text-headline-sm text-on-surface">
        <span className="md:hidden">{APP_NAME}</span>
        <span className="hidden md:inline">{section ? t(section.labelKey) : APP_NAME}</span>
      </p>
      <UserMenu />
    </header>
  );
}
