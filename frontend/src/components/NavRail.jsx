// Left rail: icon-first navigation with a short label under every icon.
import { CalendarDays, GraduationCap, TriangleAlert, Info } from 'lucide-react';
import { useT } from '../i18n.js';
import { useGo, useOperatorPath } from './routing.js';

const ITEMS = [
  { path: '/morning', icon: CalendarDays, label: 'today', match: ['/morning', '/pretask', '/debrief', '/break'] },
  { path: '/hub', icon: GraduationCap, label: 'training', match: ['/hub'] },
  { path: '/incidents', icon: TriangleAlert, label: 'incidents', match: ['/incidents'] },
  { path: '/about', icon: Info, label: 'about', match: ['/about'] },
];

export default function NavRail() {
  const t = useT();
  const go = useGo();
  const path = useOperatorPath();
  return (
    <nav className="rail" aria-label="Main">
      {ITEMS.map(({ path: to, icon: Icon, label, match }) => {
        const active = match.some((m) => path.startsWith(m));
        return (
          <button key={to} type="button" className={`rail__item ${active ? 'is-active' : ''}`} onClick={() => go(to)} aria-current={active ? 'page' : undefined}>
            <Icon size={30} strokeWidth={2.2} aria-hidden="true" />
            <span>{t(label)}</span>
          </button>
        );
      })}
    </nav>
  );
}
