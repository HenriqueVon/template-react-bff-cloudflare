import { NavLink } from 'react-router';
import { APP_NAME } from '@/app-info';
import { useT } from '@/i18n/i18n-context';
import { NAV_ITEMS } from './nav-items';

// The menu of the desktop: fixed on the left, hidden on the phone (BottomNav takes its place).
export function SideNav() {
  const t = useT();

  return (
    <nav aria-label={t('nav.main')} className="fixed left-0 top-0 z-40 hidden h-full w-sidebar flex-col overflow-y-auto bg-primary py-6 md:flex">
      <div className="mb-8 flex flex-col gap-1 px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-primary-fixed text-headline-sm font-bold text-primary" aria-hidden="true">
            {APP_NAME.charAt(0)}
          </div>
          <span className="text-headline-lg font-bold tracking-tight text-on-primary">{APP_NAME}</span>
        </div>
        <p className="ml-11 text-label-sm uppercase tracking-widest text-on-primary/60">{t('shell.tagline')}</p>
      </div>

      <ul className="flex flex-1 flex-col gap-1 px-2">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg border-l-4 px-4 py-3 text-label-md transition-colors duration-200 ${
                  isActive
                    ? 'border-primary-fixed-dim bg-white/10 text-on-primary'
                    : 'border-transparent text-on-primary/70 hover:bg-white/5 hover:text-on-primary'
                }`
              }
            >
              <item.icon size={20} aria-hidden="true" />
              {t(item.labelKey)}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
