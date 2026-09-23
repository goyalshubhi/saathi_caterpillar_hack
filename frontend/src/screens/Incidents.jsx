// Incidents: the tap buttons (always available) and the list of incidents logged on this machine.
// Incidents belong to the machine, never to an operator.
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Hand, Mic } from 'lucide-react';
import { useStore } from '../state/store.js';
import { useT } from '../i18n.js';
import { loadIncidents } from '../saathi/actions.js';
import IncidentButtons, { INCIDENT_BUTTONS } from '../components/IncidentButtons.jsx';
import { CategoryIcon } from '../components/icons.jsx';
import VoiceLog from '../components/VoiceLog.jsx';

const LABEL = { ...Object.fromEntries(INCIDENT_BUTTONS.map((b) => [b.category, b.label])), other: 'other' };

function when(ts, lang) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export default function Incidents() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const incidents = useStore((s) => s.incidents);
  const machine = useStore((s) => s.machine);

  useEffect(() => { loadIncidents(); }, []);

  return (
    <div className="screen incidents" data-testid="screen-incidents">
      <section className="incidents__log">
        <div className="incidents__head">
          <p className="eyebrow">{t('logIncident')}</p>
          <VoiceLog />
        </div>
        <IncidentButtons size="lg" />
      </section>

      <div className="hazard" role="presentation" />

      <section className="incidents__list">
        <p className="eyebrow">{t('onThisMachine')} · {machine}</p>
        {incidents.length ? (
          <ol className="incident-list" data-testid="incident-list">
            {[...incidents].reverse().map((inc, i) => (
              <motion.li key={inc.id} className={`incident-row incident-row--${inc.category}`}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, delay: 0.04 * i }}>
                <span className="incident-row__icon"><CategoryIcon category={inc.category} size={34} /></span>
                <span className="incident-row__what">{t(LABEL[inc.category] ?? 'other')}</span>
                <span className="incident-row__when">{when(inc.timestamp, lang)}</span>
                <span className="incident-row__src">
                  {inc.source === 'voice' ? <Mic size={18} aria-hidden="true" /> : <Hand size={18} aria-hidden="true" />}
                  {t(inc.source)}
                </span>
              </motion.li>
            ))}
          </ol>
        ) : (
          <p className="muted empty" data-testid="incident-empty">{t('noIncidents')}</p>
        )}
      </section>
    </div>
  );
}
