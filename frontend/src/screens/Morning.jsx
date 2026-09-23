// Morning: greeting, today's conditions, task cards in the suggested order, breaks, Machine Memory
// ("Last shift says…") and a big Start task button. The briefing is spoken on entry once per shift.
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Coffee, MessageSquareWarning, TriangleAlert, Clapperboard } from 'lucide-react';
import { render } from '../voice/index.js';
import { useStore } from '../state/store.js';
import { useT, taskTypeLabel, weatherLabel, factorLabel } from '../i18n.js';
import { loadDay, loadMemory } from '../saathi/actions.js';
import { morningEvents, orderedTasks, warningsFor } from '../saathi/briefings.js';
import { useBriefing } from '../saathi/useBriefing.js';
import { LiveAvatar } from '../avatar/Avatar.jsx';
import { TaskIcon } from '../components/icons.jsx';
import CountUp from '../components/CountUp.jsx';
import ConditionsStrip from '../components/ConditionsStrip.jsx';
import { useGo } from '../components/routing.js';
import { startDemo } from '../demo/demo.js';

const cardIn = (i) => ({ initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.22, delay: 0.05 * i } });

export default function Morning() {
  const t = useT();
  const go = useGo();
  const lang = useStore((s) => s.lang);
  const tasks = useStore((s) => s.tasks);
  const weather = useStore((s) => s.weather);
  const plan = useStore((s) => s.plan);
  const predictions = useStore((s) => s.predictions);
  const memory = useStore((s) => s.memory);
  const machine = useStore((s) => s.machine);
  const shift = useStore((s) => s.shift);
  const taskStatus = useStore((s) => s.taskStatus);
  const demoRunning = useStore((s) => s.demo.running);
  const [memoryReady, setMemoryReady] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([loadDay(), loadMemory()]).then(() => alive && setMemoryReady(true));
    return () => { alive = false; };
  }, [shift]);

  const ready = Boolean(memoryReady && tasks && plan && weather);
  useBriefing(`morning@${shift}`, () => morningEvents({ tasks, weather, plan, predictions, memory, machine }), ready);

  const ordered = orderedTasks(tasks, plan);
  const next = ordered.find((task) => (taskStatus[task.task_id] ?? task.status) !== 'done') ?? ordered[0];
  const date = new Date().toLocaleDateString(lang === 'hi' ? 'hi-IN' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="screen morning" data-testid="screen-morning">
      <section className="morning__hero">
        <LiveAvatar size={132} />
        <div className="morning__greeting">
          <p className="eyebrow">{date} · {t('shift')} {shift}</p>
          <h1 className="display">{t('goodMorning')}</h1>
        </div>
        <div className="morning__conditions">
          <p className="eyebrow">{t('conditions')}</p>
          <ConditionsStrip weather={weather} compact />
        </div>
      </section>

      <div className="hazard" role="presentation" />

      <section className="morning__tasks" aria-label={t('tasks')}>
        {ordered.map((task, i) => {
          const p = predictions[task.task_id];
          const status = taskStatus[task.task_id] ?? task.status;
          const warns = warningsFor(plan, task.task_id);
          return (
            <motion.button key={task.task_id} type="button" className={`task-card ${next?.task_id === task.task_id ? 'is-next' : ''} status-${status}`}
              onClick={() => go(`/pretask/${task.task_id}`)} data-testid={`task-card-${task.task_id}`} {...cardIn(i)}>
              <div className="task-card__top">
                <span className="task-card__order">{i + 1}</span>
                <span className="task-card__icon"><TaskIcon type={task.task_type} size={52} /></span>
                <span className={`status-pill status-pill--${status}`}>{t(status)}</span>
              </div>
              <h2 className="task-card__title">{taskTypeLabel(task.task_type, lang)}</h2>
              <p className="task-card__meta">
                {String(task.scheduled_hour).padStart(2, '0')}:00 · {weatherLabel(task.weather, lang)} · {Math.round(task.temperature_c)}°
                {warns.length > 0 && <span className="task-card__warn"><TriangleAlert size={18} aria-hidden="true" /> {warns.length}</span>}
              </p>
              {p && (
                <ul className="task-card__why" aria-label={t('whyLonger')}>
                  {p.top_factors.filter((f) => f.minutes > 0).slice(0, 2).map((f) => (
                    <li key={f.name}>{factorLabel(f.name, lang)} +{Math.round(f.minutes)}</li>
                  ))}
                </ul>
              )}
              <div className="task-card__numbers">
                <div className="task-card__saathi">
                  <span className="num num--accent"><CountUp value={p ? Math.round(p.predicted_min) : null} /></span>
                  <span className="unit">{t('min')}</span>
                  <span className="task-card__label">{t('saathiExpects')}</span>
                </div>
                <div className="task-card__cat">
                  <span className="num num--muted">{task.estimated_time_min}</span>
                  <span className="task-card__label">{t('catEstimate')}</span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </section>

      <section className="morning__bottom">
        <div className="panel morning__breaks">
          <p className="eyebrow"><Coffee size={18} aria-hidden="true" /> {t('breaks')}</p>
          <ul className="break-list">
            {(plan?.breaks ?? []).map((b) => (
              <li key={b.hour} className={`break-chip break-chip--${b.reason}`}>
                <b>{String(b.hour).padStart(2, '0')}:00</b> <span>{t(b.reason)}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className={`panel memory-card ${memory.length ? 'has-note' : ''}`} data-testid="memory-card">
          <p className="eyebrow"><MessageSquareWarning size={18} aria-hidden="true" /> {t('lastShift')}</p>
          {memory.length ? (
            memory.slice(-2).map((n) => <p key={n.id} className="memory-card__text">{render(n.message_key, n.slots, lang)}</p>)
          ) : (
            <p className="memory-card__empty">{t('noNotes')}</p>
          )}
        </div>

        <div className="morning__actions">
          {next && (
            <button type="button" className="btn btn--primary btn--xl btn--stacked" onClick={() => go(`/pretask/${next.task_id}`)} data-testid="start-task"
              title={t('briefNextTip')}>
              <Play size={34} fill="currentColor" aria-hidden="true" />
              <span>
                {t('startTask')}: {taskTypeLabel(next.task_type, lang)}
                <small className="btn__sub">{t('opensBriefing')}</small>
              </span>
            </button>
          )}
          {!demoRunning && (
            <button type="button" className="btn btn--ghost" onClick={() => startDemo()} data-testid="start-demo-morning">
              <Clapperboard size={22} aria-hidden="true" /> {t('startDemo')}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
