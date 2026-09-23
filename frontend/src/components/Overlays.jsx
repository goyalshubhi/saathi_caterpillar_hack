// Global overlays of the operator app: captions, the audio-unlock overlay and the red safety banner.
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { RotateCcw, ShieldAlert, Power } from 'lucide-react';
import { render } from '../voice/index.js';
import { store, useStore } from '../state/store.js';
import { useT } from '../i18n.js';
import { repeat } from '../saathi/voiceRuntime.js';
import Avatar from '../avatar/Avatar.jsx';

// Every spoken line is also shown as a large caption for ~5 seconds.
export function Caption({ still = false }) {
  const t = useT();
  const raw = useStore((s) => s.caption);
  // In-task: the red banner already shows safety lines and the lesson card shows lessons.
  const caption = still && raw && (raw.priority === 'safety' || raw.key.startsWith('lesson_')) ? null : raw;
  const tone = caption?.priority === 'safety' ? 'safety' : caption?.priority === 'care' ? 'care' : 'info';
  const motionProps = still ? {} : { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 8 }, transition: { duration: 0.2 } };
  return (
    <div className="caption-slot" aria-live="polite">
      <AnimatePresence>
        {caption && (
          <motion.div key={caption.id} className={`caption caption--${tone}`} data-testid="caption" {...motionProps}>
            <p className="caption__text">{caption.text}</p>
            <button type="button" className="caption__repeat" onClick={() => repeat()} aria-label={t('repeat')}>
              <RotateCcw size={24} aria-hidden="true" />
              <span>{t('repeat')}</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Browsers block audio until the user taps once.
export function StartOverlay({ onStart }) {
  const t = useT();
  const unlocked = useStore((s) => s.unlocked);
  if (unlocked) return null;
  const start = () => {
    store.set({ unlocked: true });
    onStart?.();
  };
  return (
    <div className="start-overlay" role="dialog" aria-modal="true" aria-label={t('startSaathi')}>
      <div className="start-overlay__card">
        <Avatar state="idle" size={180} />
        <button type="button" className="btn btn--primary btn--xl" onClick={start} data-testid="start-saathi" autoFocus>
          <Power size={34} aria-hidden="true" /> {t('startSaathi')}
        </button>
        <p className="start-overlay__hint">{t('startHint')}</p>
      </div>
    </div>
  );
}

// Full-width pulsing red banner for safety interrupts (In-task screen).
export function SafetyBanner() {
  const safety = useStore((s) => s.safety);
  const lang = useStore((s) => s.lang);
  const reduce = useReducedMotion();
  return (
    <AnimatePresence>
      {safety && (
        <motion.div key={safety.id} className="safety-banner" role="alert" data-testid="safety-banner"
          initial={{ opacity: 0, y: -24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
          <motion.div className="safety-banner__pulse" aria-hidden="true"
            animate={reduce ? { opacity: 0.35 } : { opacity: [0.15, 0.55, 0.15] }}
            transition={reduce ? { duration: 0 } : { duration: 0.9, repeat: Infinity }} />
          <ShieldAlert size={56} strokeWidth={2.4} aria-hidden="true" />
          <p>{render(safety.key, safety.slots, safety.lang ?? lang)}</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
