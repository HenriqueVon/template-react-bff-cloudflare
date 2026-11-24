import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router';
import { Ellipsis } from 'lucide-react';
import { Modal } from '@/components/Modal';
import { useT } from '@/i18n/i18n-context';
import { NAV_ITEMS, sectionOf } from './nav-items';

const FIXED_ITEMS = NAV_ITEMS.filter((item) => item.mobile);
const MORE_ITEMS = NAV_ITEMS.filter((item) => !item.mobile);

// The menu of the phone: the sections marked `mobile` in a bar at the bottom, and "More" for the rest (only when there is
// a rest), so no section is out of reach on a small screen.
export function BottomNav() {
  const t = useT();
  const [moreOpen, setMoreOpen] = useState(false);
  const { pathname } = useLocation();
  const section = sectionOf(pathname);
  const moreActive = MORE_ITEMS.some((item) => item === section);
  const columns = FIXED_ITEMS.length + (MORE_ITEMS.length > 0 ? 1 : 0);

  const itemClass = (active: boolean) =>
    `flex min-w-0 flex-col items-center justify-center rounded-xl px-1 py-1 transition-colors ${
      active ? 'bg-secondary-container text-on-secondary-container' : 'text-on-surface-variant'
    }`;

  return (
    <>
      <nav
        aria-label={t('nav.main')}
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        className="fixed bottom-0 z-40 grid h-20 w-full items-center border-t border-outline-variant bg-surface px-1 md:hidden"
      >
        {FIXED_ITEMS.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => itemClass(isActive)}>
            <item.icon size={22} aria-hidden="true" />
            <span className="mt-1 break-words text-center text-label-sm leading-tight">{t(item.labelKey)}</span>
          </NavLink>
        ))}
        {MORE_ITEMS.length > 0 && (
          <button type="button" aria-haspopup="dialog" onClick={() => setMoreOpen(true)} className={itemClass(moreActive)}>
            <Ellipsis size={22} aria-hidden="true" />
            <span className="mt-1 text-center text-label-sm leading-tight">{t('nav.more')}</span>
          </button>
        )}
      </nav>

      {moreOpen && (
        <Modal title={t('nav.moreSections')} onClose={() => setMoreOpen(false)}>
          <ul className="flex flex-col gap-1">
            {MORE_ITEMS.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={() => setMoreOpen(false)}
                  className="flex items-center gap-3 rounded-lg px-3 py-3 text-label-md text-on-surface hover:bg-surface-container"
                >
                  <item.icon size={20} aria-hidden="true" />
                  {t(item.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </>
  );
}
