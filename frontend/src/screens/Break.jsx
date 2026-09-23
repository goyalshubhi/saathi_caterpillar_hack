// Break: avatar resting with a water bottle inside a calm countdown ring, teal theme, one hydration
// line, and what comes next.
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Droplets, ArrowLeft, HeartPulse, Coffee } from 'lucide-react';
import { useStore } from '../state/store.js';
import { useT, taskTypeLabel } from '../i18n.js';
import { useBriefing } from '../saathi/useBriefing.js';
import { orderedTasks } from '../saathi/briefings.js';
import { loadDay } from '../saathi/actions.js';
import { LiveAvatar } from '../avatar/Avatar.jsx';
import { TaskIcon } from '../components/icons.jsx';
import { useGo } from '../components/routing.js';

const BREAK_MIN = 10;
const R = 150;
const C = 2 * Math.PI * R;

export default function Break() {
  const t = useT();
  const go = useGo();
  const reduce = useReducedMotion();
  const [params] = useSearchParams();
  const reason = params.get('reason') ?? 'planned'; // planned | care (fatigue drift)
  const lang = useStore((s) => s.lang);
  const shift = useStore((s) => s.shift);
  const demoRunning = useStore((s) => s.demo.running);
  const next = useStore((s) => orderedTasks(s.tasks, s.plan).find((x) => (s.taskStatus[x.task_id] ?? x.status) !== 'done'));
  const [left, setLeft] = useState(BREAK_MIN * 60);
  const [visit] = useState(() => Date.now()); // each visit to the break screen speaks once

  useEffect(() => {
    loadDay();
    const id = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, []);

  // The demo speaks its own break lines (fatigue finding first); otherwise speak on entry.
  useBriefing(demoRunning ? null : `break:${reason}@${shift}@${visit}`,
    () => [{ priority: 'care', mode: 'care', message_key: reason === 'care' ? 'care_break' : 'break_time', slots: {} }], true);

  const mm = String(Math.floor(left / 60)).padStart(2, '0');
  const ss = String(left % 60).padStart(2, '0');
  const frac = left / (BREAK_MIN * 60);
  return (
    <div className="screen break" data-testid="screen-break">
      <div className="break__ring">
        <svg viewBox="0 0 340 340" aria-hidden="true">
          <circle cx="170" cy="170" r={R} className="break__ring-track" />
          <circle cx="170" cy="170" r={R} className="break__ring-fill" strokeDasharray={C} strokeDashoffset={C * (1 - frac)} />
        </svg>
        {!reduce && (
          <motion.span className="break__breath" aria-hidden="true" animate={{ scale: [1, 1.06, 1], opacity: [0.35, 0.1, 0.35] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} />
        )}
        <LiveAvatar rest size={220} />
      </div>
      <div className="break__body">
        <p className="eyebrow">
          {reason === 'care' ? <HeartPulse size={22} aria-hidden="true" /> : <Coffee size={22} aria-hidden="true" />}
          {reason === 'care' ? t('careBreak') : t('breakTime')}
        </p>
        <p className="break__timer" aria-live="off" data-testid="break-timer">{mm}:{ss}</p>
        <p className="break__line"><Droplets size={30} aria-hidden="true" /> {t('drinkWater')}</p>
        {next && (
          <p className="break__next"><span>{t('next')}</span> <TaskIcon type={next.task_type} size={30} /> {taskTypeLabel(next.task_type, lang)} · {String(next.scheduled_hour).padStart(2, '0')}:00</p>
        )}
        <button type="button" className="btn btn--care btn--xl" onClick={() => go('/morning')}>
          <ArrowLeft size={30} aria-hidden="true" /> {t('imBack')}
        </button>
      </div>
    </div>
  );
}
