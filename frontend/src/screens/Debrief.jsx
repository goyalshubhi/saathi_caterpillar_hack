// Debrief (shown once per task): one stacked bar splitting the overrun into "not in your control" vs
// "yours to win back", and 2–4 plain-language behaviour-finding cards. Supportive; never a score.
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { GraduationCap, CalendarDays, CheckCircle2 } from 'lucide-react';
import { render } from '../voice/index.js';
import { store, useStore } from '../state/store.js';
import { useT, taskTypeLabel, factorLabel, findingTitle } from '../i18n.js';
import { loadDay, runDebrief } from '../saathi/actions.js';
import { debriefEvents, debriefSplit } from '../saathi/briefings.js';
import { useBriefing } from '../saathi/useBriefing.js';
import { LiveAvatar } from '../avatar/Avatar.jsx';
import { FindingIcon } from '../components/icons.jsx';
import CountUp from '../components/CountUp.jsx';
import { useGo } from '../components/routing.js';

export function OverrunBar({ debrief, lang, t }) {
  const { over, uncontrollable, controllable } = debriefSplit(debrief);
  if (over <= 0) return null;
  const factors = (debrief.top_factors ?? []).filter((f) => f.minutes > 0);
  return (
    <div className="overrun" data-testid="overrun-bar" data-over={over}>
      <div className="overrun__bar" role="img" aria-label={`${uncontrollable} + ${controllable} = ${over} min`}>
        <motion.div className="overrun__seg overrun__seg--uncontrollable" data-testid="seg-uncontrollable" data-minutes={uncontrollable}
          initial={{ width: 0 }} animate={{ width: `${(uncontrollable / over) * 100}%` }} transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}>
          <span>{uncontrollable}</span>
        </motion.div>
        <motion.div className="overrun__seg overrun__seg--controllable" data-testid="seg-controllable" data-minutes={controllable}
          initial={{ width: 0 }} animate={{ width: `${(controllable / over) * 100}%` }} transition={{ duration: 0.6, delay: 0.8, ease: 'easeOut' }}>
          <span>{controllable}</span>
        </motion.div>
      </div>
      <div className="overrun__legend">
        <div className="overrun__key">
          <span className="swatch swatch--uncontrollable" aria-hidden="true" />
          <div>
            <b>{t('notYourControl')} · {uncontrollable} {t('min')}</b>
            <span>{factors.map((f) => `${factorLabel(f.name, lang)} ${Math.round(f.minutes)}`).join(' · ')}</span>
          </div>
        </div>
        <div className="overrun__key">
          <span className="swatch swatch--controllable" aria-hidden="true" />
          <div>
            <b>{t('yoursToWin')} · {controllable} {t('min')}</b>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Debrief() {
  const { taskId } = useParams();
  const t = useT();
  const go = useGo();
  const lang = useStore((s) => s.lang);
  const task = useStore((s) => s.tasks?.find((x) => x.task_id === taskId));
  const debrief = useStore((s) => (s.debrief?.task_id === taskId ? s.debrief : null));
  const findings = useStore((s) => s.findings);
  const shift = useStore((s) => s.shift);
  // "Shown once": remember if it was already reviewed before this visit.
  const [seenBefore] = useState(() => Boolean(store.get().debriefSeen[`${taskId}@${store.get().shift}`]));

  useEffect(() => {
    if (seenBefore) return undefined;
    loadDay();
    runDebrief(taskId);
    return () => store.set((s) => ({ debriefSeen: { ...s.debriefSeen, [`${taskId}@${s.shift}`]: true } }));
  }, [taskId, seenBefore]);

  useBriefing(seenBefore ? null : `debrief:${taskId}@${shift}`, () => debriefEvents(debrief, findings ?? []), Boolean(debrief && findings));

  if (seenBefore) {
    return (
      <div className="screen debrief debrief--seen" data-testid="screen-debrief">
        <CheckCircle2 size={72} aria-hidden="true" />
        <h1 className="display">{t('debriefDone')}</h1>
        <div className="row-actions">
          <button type="button" className="btn btn--primary btn--lg" onClick={() => go('/hub')}><GraduationCap size={28} aria-hidden="true" /> {t('openHub')}</button>
          <button type="button" className="btn btn--secondary btn--lg" onClick={() => go('/morning')}><CalendarDays size={28} aria-hidden="true" /> {t('nextTask')}</button>
        </div>
      </div>
    );
  }

  const split = debrief ? debriefSplit(debrief) : null;
  return (
    <div className="screen debrief" data-testid="screen-debrief">
      <header className="debrief__head">
        <LiveAvatar size={120} />
        <div>
          <p className="eyebrow">{t('taskDone')} · {task ? taskTypeLabel(task.task_type, lang) : ''}</p>
          {split && split.over > 0 ? (
            <h1 className="display debrief__headline">
              <span className="num-xl num--strong"><CountUp value={split.over} /></span>
              <span className="debrief__unit">{t('min')} {t('overEstimate')}</span>
            </h1>
          ) : (
            <h1 className="display debrief__headline">{split ? t('onTime') : ''}</h1>
          )}
        </div>
        <button type="button" className="btn btn--secondary" onClick={() => go('/morning')}><CalendarDays size={26} aria-hidden="true" /> {t('nextTask')}</button>
      </header>

      {debrief && <OverrunBar debrief={debrief} lang={lang} t={t} />}

      <section className="findings" aria-label={t('whatWeNoticed')}>
        <p className="eyebrow">{t('whatWeNoticed')}</p>
        <div className="findings__grid">
          {(findings ?? []).slice(0, 4).map((f, i) => (
            <motion.article key={`${f.type}-${f.window_timestamp}`} className="finding-card" data-testid="finding-card"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, delay: 1.1 + i * 0.08 }}>
              <span className="finding-card__icon"><FindingIcon type={f.type} /></span>
              <div>
                <h3>{findingTitle(f.type, lang)}</h3>
                <p>{render(f.message_key, f.slots, lang)}</p>
              </div>
            </motion.article>
          ))}
        </div>
      </section>

      <footer className="screen-foot">
        <button type="button" className="btn btn--primary btn--xl" onClick={() => go('/hub')} data-testid="open-hub"><GraduationCap size={28} aria-hidden="true" /> {t('openHub')}</button>
      </footer>
    </div>
  );
}
