// Training Hub: Recommended (from behaviour findings + today's conditions), Library (tap to hear),
// Completed. Instructor booking is shown but disabled ("Coming soon").
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Volume2, CheckCircle2, CalendarClock, Sparkles } from 'lucide-react';
import { useStore } from '../state/store.js';
import { useT, lessonTitle } from '../i18n.js';
import { loadDay, markLessonDone } from '../saathi/actions.js';
import { say, whenIdle } from '../saathi/voiceRuntime.js';
import { LESSONS, recommendedLessons } from '../saathi/lessons.js';
import { LiveAvatar } from '../avatar/Avatar.jsx';
import { LessonArt } from '../components/icons.jsx';

const BY_KEY = Object.fromEntries(LESSONS.map((l) => [l.key, l]));

async function playLesson(key) {
  // Asked for by the operator: info priority, so the one-coaching-line budget does not block it.
  const r = say({ priority: 'info', mode: 'friendly', message_key: key });
  if (r.accepted) {
    await whenIdle();
    markLessonDone(key);
  }
}

function LessonCard({ lesson, lang, t, done, i, featured = false }) {
  const playing = useStore((s) => s.speaking?.event?.message_key === lesson.key);
  return (
    <motion.button type="button" className={`lesson ${featured ? 'lesson--featured' : ''} ${playing ? 'is-playing' : ''}`}
      onClick={() => playLesson(lesson.key)} data-testid={`lesson-${lesson.key}`}
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2, delay: 0.04 * i }}>
      <LessonArt art={lesson.art} />
      <span className="lesson__title">{lessonTitle(lesson.key, lang)}</span>
      <span className="lesson__foot">
        {done ? <CheckCircle2 size={22} aria-hidden="true" className="lesson__done" /> : <Volume2 size={22} aria-hidden="true" />}
        {playing ? t('speaking') : t('tapToHear')}
      </span>
    </motion.button>
  );
}

export default function TrainingHub() {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const findings = useStore((s) => s.findings);
  const weather = useStore((s) => s.weather);
  const tasks = useStore((s) => s.tasks);
  const completed = useStore((s) => s.completedLessons);

  useEffect(() => { loadDay(); }, []);

  const recommended = recommendedLessons({ findings: findings ?? [], weather: weather ?? [], tasks: tasks ?? [] }).map((k) => BY_KEY[k]).filter(Boolean).slice(0, 3);

  return (
    <div className="screen hub" data-testid="screen-hub">
      <section className="hub__top">
        <LiveAvatar size={110} />
        <div className="hub__recommended">
          <p className="eyebrow"><Sparkles size={18} aria-hidden="true" /> {t('recommended')}</p>
          <div className="lesson-row" data-testid="hub-recommended">
            {recommended.length ? recommended.map((l, i) => (
              <LessonCard key={l.key} lesson={l} lang={lang} t={t} done={completed.includes(l.key)} i={i} featured />
            )) : <p className="muted">{t('nothingYet')}</p>}
          </div>
        </div>
      </section>

      <div className="hazard" role="presentation" />

      <section className="hub__library">
        <p className="eyebrow">{t('library')}</p>
        <div className="lesson-grid" data-testid="hub-library">
          {LESSONS.map((l, i) => <LessonCard key={l.key} lesson={l} lang={lang} t={t} done={completed.includes(l.key)} i={i} />)}
        </div>
      </section>

      <section className="hub__bottom">
        <div className="panel hub__completed" data-testid="hub-completed">
          <p className="eyebrow"><CheckCircle2 size={18} aria-hidden="true" /> {t('completed')} · {completed.length}</p>
          {completed.length ? (
            <ul className="chips">{completed.map((k) => <li key={k} className="chip chip--done">{lessonTitle(k, lang)}</li>)}</ul>
          ) : <p className="muted">{t('nothingYet')}</p>}
        </div>
        <button type="button" className="btn btn--secondary btn--lg" disabled aria-disabled="true">
          <CalendarClock size={26} aria-hidden="true" /> {t('bookInstructor')} <span className="soon">{t('comingSoon')}</span>
        </button>
      </section>
    </div>
  );
}
