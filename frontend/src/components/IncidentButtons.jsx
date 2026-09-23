// Three huge tap-to-log incident buttons (always available on In-task and Incidents).
import { useState } from 'react';
import { Check } from 'lucide-react';
import { useStore } from '../state/store.js';
import { useT } from '../i18n.js';
import { logIncident } from '../saathi/actions.js';
import { CategoryIcon } from './icons.jsx';

export const INCIDENT_BUTTONS = [
  { category: 'near_miss', label: 'nearMiss' },
  { category: 'person_in_zone', label: 'personInZone' },
  { category: 'machine_issue', label: 'machineIssue' },
];

export default function IncidentButtons({ size = 'xl' }) {
  const t = useT();
  const flash = useStore((s) => s.incidentFlash);
  const [logged, setLogged] = useState(null);
  const [busy, setBusy] = useState(false);

  async function tap(category) {
    if (busy) return;
    setBusy(true);
    try {
      await logIncident(category, 'tap');
      setLogged(category);
      setTimeout(() => setLogged((c) => (c === category ? null : c)), 3000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`incident-buttons incident-buttons--${size}`}>
      {INCIDENT_BUTTONS.map(({ category, label }) => {
        const done = logged === category;
        return (
          <button key={category} type="button" data-testid={`incident-${category}`}
            className={`incident-btn incident-btn--${category} ${flash === category ? 'is-pressed' : ''} ${done ? 'is-logged' : ''}`}
            onClick={() => tap(category)}>
            {done ? <Check size={size === 'xl' ? 56 : 40} strokeWidth={3} aria-hidden="true" /> : <CategoryIcon category={category} size={size === 'xl' ? 56 : 40} />}
            <span>{done ? t('logged') : t(label)}</span>
          </button>
        );
      })}
    </div>
  );
}
