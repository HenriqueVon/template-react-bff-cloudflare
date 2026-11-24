import {
  LayoutDashboard,
  // @template:example:start
  Layers,
  // @template:example:end
  type LucideIcon,
} from 'lucide-react';
import type { MessageKey } from '@/i18n/messages';

export type NavItem = {
  to       : string;
  // The key of the name in the dictionary; the screens translate it.
  labelKey : MessageKey;
  icon     : LucideIcon;
  // Shown in the bottom bar of the phone; the others open from "More".
  mobile?  : boolean;
};

// The sections of the app, in the order of the menu. The side menu, the bottom bar, the top bar title, the page title and
// the routes are all built from this list, so a section cannot exist in one and be missing in another. The bottom bar
// has room for four sections; put the others without `mobile` and they open from "More".
export const NAV_ITEMS: NavItem[] = [
  { to: '/', labelKey: 'nav.overview', icon: LayoutDashboard, mobile: true },
  // @template:example:start
  { to: '/examples', labelKey: 'nav.examples', icon: Layers, mobile: true },
  // @template:example:end
];

// The section of an address: the item whose path is the address or the start of it (/examples/new belongs to /examples).
// The home page matches only the exact address.
export function sectionOf(pathname: string): NavItem | undefined {
  return NAV_ITEMS.find((item) => (item.to === '/' ? pathname === '/' : pathname === item.to || pathname.startsWith(`${item.to}/`)));
}
