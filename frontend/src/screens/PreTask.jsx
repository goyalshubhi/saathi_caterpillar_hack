// Pre-task: CAT estimate vs Saathi prediction as large count-ups, top factors as bars, the task's
// condition safety warnings. Everything is spoken on entry.
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Play, ShieldAlert, ShieldCheck, ArrowRight } from 'lucide-react';
import { render } from '../voice/index.js';
import { useStore } from '../state/store.js';
import { useT, taskTypeLabel, weatherLabel, factorLabel } from '../i18n.js';
import { loadDay, ensurePrediction } from '../saathi/actions.js';
import { pretaskEvents, warningsFor } from '../saathi/briefings.js';
import { useBriefing } from '../saathi/useBriefing.js';
import { LiveAvatar } from '../avatar/Avatar.jsx';
import { TaskIcon } from '../components/icons.jsx';
import CountUp from '../components/CountUp.jsx';
import { useGo } from '../components/routing.js';

export function FactorBars({ factors, lang, scale }) {
  const list = [...(factors ?? [])].filter((f) => f.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  const max = scale ?? Math.max(1, ...list.map((f) => f.minutes));
  return (
    <ul className="factor-bars" data-testid="factor-bars">
      {list.map((f, i) => (
        <li key={f.name} className="factor-bars__row">
          <span className="factor-bars__name">{factorLabel(f.name, lang)}</span>
          <span className="factor-bars__track">
            <motion.span className="factor-bars__fill" initial={{ width: 0 }} animate={{ width: `${(f.minutes / max) * 100}%` }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.08, ease: 'easeOut' }} />
          </span>
          <span className="factor-bars__min">+{Math.round(f.minutes)}</span>
        </li>
      ))}
    </ul>
  );
}

export default function PreTask() {
  const { taskId } = useParams();
  const t = useT();
  const go = useGo();
  const lang = useStore((s) => s.lang);
  const tasks = useStore((s) => s.tasks);
  const plan = useStore((s) => s.plan);
  const prediction = useStore((s) => s.whatIf?.task_id === taskId ? s.whatIf : s.predictions[taskId]);
  const whatIfTask = useStore((s) => (s.whatIf?.task_id === taskId ? s.whatIf.task : null));
  const shift = useStore((s) => s.shift);

  useEffect(() => {
    loadDay().then(() => ensurePrediction(taskId));
  }, [taskId]);

  const baseTask = tasks?.find((x) => x.task_id === taskId);
  const task = whatIfTask ?? baseTask;
  const ready = Boolean(task && prediction && plan);
  useBriefing(`pretask:${taskId}@${shift}`, () => pretaskEvents({ task, prediction, plan }), ready);

  if (!task) return <div className="screen" data-testid="screen-pretask" />;
  const warnings = warningsFor(plan, taskId);
  const diff = prediction ? Math.round(prediction.predicted_min - prediction.cat_estimate_min) : null;

  return (
    <div className="screen pretask" data-testid="screen-pretask">
      <header className="screen-head">
        <button type="button" className="btn btn--icon" onClick={() => go('/morning')} aria-label={t('back')}>
          <ArrowLeft size={30} aria-hidden="true" />
        </button>
        <span className="screen-head__icon"><TaskIcon type={task.task_type} size={56} /></span>
        <div>
          <h1 className="display">{taskTypeLabel(task.task_type, lang)}</h1>
          <p className="screen-head__meta">
            {weatherLabel(task.weather, lang)} · {Math.round(task.temperature_c)}° · {String(task.scheduled_hour).padStart(2, '0')}:00
          </p>
        </div>
        <LiveAvatar size={96} />
      </header>

      <section className="estimate" aria-label="Estimate">
        <div className="estimate__cat">
          <span className="estimate__label">{t('catEstimate')}</span>
          <span className="num-xl num--muted"><CountUp value={prediction ? Math.round(prediction.cat_estimate_min) : null} /></span>
          <span className="unit">{t('min')}</span>
        </div>
        <ArrowRight className="estimate__arrow" size={48} aria-hidden="true" />
        <div className="estimate__saathi" data-testid="saathi-prediction">
          <span className="estimate__label">{t('saathiExpects')}</span>
          <span className="num-xl num--accent"><CountUp value={prediction ? Math.round(prediction.predicted_min) : null} duration={1.2} /></span>
          <span className="unit">{t('min')}</span>
          {diff !== null && diff !== 0 && <span className="estimate__diff">{diff > 0 ? `+${diff}` : diff} {t('min')}</span>}
        </div>
        <div className="estimate__factors panel">
          <p className="eyebrow">{t('whyLonger')}</p>
          <FactorBars factors={prediction?.top_factors} lang={lang} />
        </div>
      </section>

      <section className="warnings" aria-label={t('safetyToday')}>
        <p className="eyebrow">{t('safetyToday')}</p>
        {warnings.length ? (
          <ul className="warning-list">
            {warnings.map((w, i) => (
              <motion.li key={w.message_key} className="warning-card" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.2, delay: 0.1 * i }}>
                <ShieldAlert size={36} aria-hidden="true" />
                <p>{render(w.message_key, w.slots, lang)}</p>
              </motion.li>
            ))}
          </ul>
        ) : (
          <p className="warning-none"><ShieldCheck size={28} aria-hidden="true" /> {t('noWarnings')}</p>
        )}
      </section>

      <footer className="screen-foot">
        <button type="button" className="btn btn--primary btn--xl" onClick={() => go(`/intask/${taskId}`)} data-testid="go-intask">
          <Play size={34} fill="currentColor" aria-hidden="true" /> {t('startTask')}
        </button>
      </footer>
    </div>
  );
}
