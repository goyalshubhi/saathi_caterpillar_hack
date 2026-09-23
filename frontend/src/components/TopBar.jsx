// Operator top bar: Saathi chip, language, theme, coaching mute, clock (+ demo step, offline /
// voice-fallback notices).
import { useEffect, useState } from 'react';
import { Sun, Moon, Volume2, VolumeX, WifiOff, Languages, Clapperboard } from 'lucide-react';
import { useStore } from '../state/store.js';
import { useT } from '../i18n.js';
import { toggleLang, toggleTheme } from '../saathi/actions.js';
import { setQuiet } from '../saathi/voiceRuntime.js';
import Avatar, { useAvatarState } from '../avatar/Avatar.jsx';
import { DEMO_STEPS } from '../demo/demo.js';

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);
  return <time className="topbar__clock" dateTime={now.toISOString()}>{now.toTimeString().slice(0, 5)}</time>;
}

// Small status chip. On the In-task screen it replaces the avatar entirely (no face, just the state).
export function SaathiChip({ withFace = true }) {
  const t = useT();
  const quiet = useStore((s) => s.quiet);
  const speaking = useStore((s) => s.speaking);
  const listening = useStore((s) => s.listening); // only while speech recognition is really on
  const state = useAvatarState();
  const label = speaking ? t('speaking') : listening ? t('listeningNow') : quiet ? t('muted') : t('ready');
  const tone = speaking ? (state === 'alert' ? 'alert' : 'speaking') : listening ? 'listening' : quiet ? 'quiet' : 'ready';
  return (
    <div className={`saathi-chip saathi-chip--${tone}`} data-testid="saathi-chip" aria-live="polite">
      {withFace ? <Avatar state={state} size={40} testId="chip-avatar" /> : <span className="saathi-chip__dot" aria-hidden="true" />}
      <span className="saathi-chip__name">Saathi</span>
      <span className="saathi-chip__state">{label}</span>
    </div>
  );
}

export default function TopBar({ inTask = false }) {
  const t = useT();
  const lang = useStore((s) => s.lang);
  const theme = useStore((s) => s.theme);
  const quiet = useStore((s) => s.quiet);
  const apiMode = useStore((s) => s.apiMode);
  const fallback = useStore((s) => s.fallbackToEnglish && s.lang === 'hi');
  const machine = useStore((s) => s.machine);
  const demo = useStore((s) => s.demo);
  const step = demo.running ? DEMO_STEPS[demo.step - 1] : null;

  return (
    <header className="topbar">
      <SaathiChip withFace={!inTask} />
      <div className="topbar__machine"><span className="topbar__label">{t('machine')}</span> {machine}</div>
      <div className="topbar__notices">
        {step && (
          <span className="badge badge--demo" data-testid="demo-step">
            <Clapperboard size={16} aria-hidden="true" /> {demo.paused ? 'Paused · ' : ''}Demo {step.n}/{DEMO_STEPS.length} · {step.short}
          </span>
        )}
        {apiMode === 'fixture' && (
          <span className="badge badge--offline" data-testid="offline-badge"><WifiOff size={16} aria-hidden="true" /> {t('offlineData')}</span>
        )}
        {fallback && <span className="badge badge--caution" data-testid="fallback-notice">{t('fallbackNotice')}</span>}
      </div>
      <div className="topbar__controls">
        <button type="button" className="tb-btn" onClick={toggleLang} aria-label={`Language: ${lang === 'en' ? 'English' : 'Hindi'}. Switch to ${lang === 'en' ? 'Hindi' : 'English'}`}
          title={t('langTip')} data-testid="lang-toggle">
          <Languages size={22} aria-hidden="true" />
          <span className="tb-btn__seg">
            <b className={lang === 'en' ? 'on' : ''}>EN</b><b className={lang === 'hi' ? 'on' : ''}>हिं</b>
          </span>
        </button>
        <button type="button" className="tb-btn" onClick={toggleTheme} aria-label={`Theme: ${theme}. Switch to ${theme === 'dark' ? 'light' : 'dark'}`}
          title={t('themeTip')} data-testid="theme-toggle">
          <span className="tb-btn__seg">
            <b className={theme === 'dark' ? 'on' : ''}><Moon size={18} aria-hidden="true" /> {t('dark')}</b>
            <b className={theme === 'light' ? 'on' : ''}><Sun size={18} aria-hidden="true" /> {t('light')}</b>
          </span>
        </button>
        <button type="button" className={`tb-btn tb-btn--mute ${quiet ? 'tb-btn--muted' : ''}`} onClick={() => setQuiet(!quiet)}
          aria-pressed={quiet} title={t('muteTip')} data-testid="quiet-toggle">
          {quiet ? <VolumeX size={24} aria-hidden="true" /> : <Volume2 size={24} aria-hidden="true" />}
          <span className="tb-btn__text">{quiet ? t('coachingMuted') : t('coachingMute')}</span>
        </button>
        <Clock />
      </div>
    </header>
  );
}
