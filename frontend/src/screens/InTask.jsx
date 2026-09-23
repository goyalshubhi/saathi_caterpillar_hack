// In-task: driven by the replay engine. One progress bar, the machine state, three huge incident
// buttons. No avatar here (voice only, status chip in the top bar). The only motion on this screen
// is the safety banner and the progress bar.
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Pause, Play, Flag, Lightbulb } from 'lucide-react';
import { store, useStore } from '../state/store.js';
import { useT, taskTypeLabel, lessonTitle } from '../i18n.js';
import { loadDay, loadScenario, ensurePrediction } from '../saathi/actions.js';
import { startReplay, pauseReplay, resumeReplay, setReplaySpeed, replayActive, SPEEDS } from '../saathi/replayRuntime.js';
import { SafetyBanner } from '../components/Overlays.jsx';
import IncidentButtons from '../components/IncidentButtons.jsx';
import { TaskIcon } from '../components/icons.jsx';
import { useGo } from '../components/routing.js';

export default function InTask() {
  const { taskId } = useParams();
  const t = useT();
  const go = useGo();
  const lang = useStore((s) => s.lang);
  const task = useStore((s) => s.tasks?.find((x) => x.task_id === taskId));
  const prediction = useStore((s) => s.predictions[taskId]);
  const replay = useStore((s) => s.replay);
  const lesson = useStore((s) => s.lesson);

  // Start the replay for this task unless it is already running (e.g. coming back from Incidents).
  useEffect(() => {
    let alive = true;
    (async () => {
      await loadDay();
      await ensurePrediction(taskId);
      const scenario = await loadScenario();
      if (!alive || !scenario) return;
      const { replay: r, demo } = store.get();
      const running = replayActive() && r.taskId === taskId;
      // The demo controller starts its own replay at demo pace.
      if (!running && !demo.running) startReplay(scenario.task_id === taskId ? scenario : { ...scenario, task_id: taskId });
    })();
    return () => { alive = false; };
  }, [taskId]);

  const predicted = prediction ? Math.round(prediction.predicted_min) : task?.estimated_time_min ?? 0;
  const frac = replay.total ? replay.index / replay.total : 0;
  const elapsed = Math.round(frac * predicted);
  const working = replay.window ? !replay.idle : true;

  return (
    <div className="screen intask" data-testid="screen-intask">
      <SafetyBanner />

      <header className="intask__head">
        <span className="intask__icon"><TaskIcon type={task?.task_type} size={52} /></span>
        <h1 className="display">{task ? taskTypeLabel(task.task_type, lang) : ''}</h1>
        <span className={`machine-state ${working ? 'is-working' : 'is-idle'}`} data-testid="machine-state">
          <span className="machine-state__dot" aria-hidden="true" />
          {working ? t('working') : t('idle')}
        </span>
        <div className="speed-control" role="group" aria-label="Replay speed">
          <button type="button" className="speed-control__btn" onClick={() => (replay.playing ? pauseReplay() : resumeReplay())} aria-label={replay.playing ? 'Pause replay' : 'Play replay'} title={replay.playing ? 'Pause replay' : 'Play replay'} disabled={replay.done}>
            {replay.playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
          </button>
          {SPEEDS.map((s) => (
            <button key={s} type="button" className={`speed-control__btn ${replay.speed === s ? 'is-on' : ''}`} onClick={() => setReplaySpeed(s)} aria-pressed={replay.speed === s} title={`Replay speed ${s}×`}>
              {s}×
            </button>
          ))}
          {!SPEEDS.includes(replay.speed) && <span className="speed-control__btn is-on" title="Demo pace">{replay.speed > 1000 ? 'max' : `${replay.speed}×`}</span>}
        </div>
      </header>

      <section className="progress" aria-label={t('elapsed')}>
        <div className="progress__numbers">
          <span className="num num--strong" data-testid="elapsed-min">{elapsed}</span>
          <span className="progress__of">/ {predicted} {t('min')}</span>
          <span className="progress__label">{t('saathiExpects')}</span>
        </div>
        <div className="progress__track" role="progressbar" aria-valuemin={0} aria-valuemax={predicted} aria-valuenow={elapsed}>
          <motion.div className={`progress__fill ${working ? '' : 'is-idle'}`} animate={{ width: `${frac * 100}%` }} transition={{ duration: 0.4, ease: 'linear' }} />
        </div>
      </section>

      <div className="intask__lesson-slot">
        {lesson && !replay.done && (
          <div className="lesson-card" data-testid="lesson-card">
            <Lightbulb size={30} aria-hidden="true" />
            <div>
              <p className="lesson-card__title">{lessonTitle(lesson.key, lang)}</p>
              <p className="lesson-card__text">{lesson.text}</p>
            </div>
          </div>
        )}
        {replay.done && (
          <button type="button" className="btn btn--primary btn--xl" onClick={() => go(`/debrief/${taskId}`)} data-testid="finish-task">
            <Flag size={32} aria-hidden="true" /> {t('finishTask')}
          </button>
        )}
      </div>

      <IncidentButtons size="xl" />
    </div>
  );
}
