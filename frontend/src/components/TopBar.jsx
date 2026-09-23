// Operator top bar: Saathi chip, language, theme, quiet mode, clock (+ offline / voice-fallback notices).
import { useEffect, useState } from 'react';
import { Sun, Moon, Volume2, VolumeX, WifiOff, Languages } from 'lucide-react';
import { useStore } from '../state/store.js';
import { useT } from '../i18n.js';
import { toggleLang, toggleTheme } from '../saathi/actions.js';
import { setQuiet } from '../saathi/voiceRuntime.js';
import Avatar, { useAvatarState } from '../avatar/Avatar.jsx';

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
  const state = useAvatarState();
  const label = speaking ? t('speaking') : quiet ? t('quietMode') : t('listening');
  const tone = speaking ? (state === 'alert' ? 'alert' : 'speaking') : quiet ? 'quiet' : 'listening';
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

  return (
    <header className="topbar">
      <SaathiChip withFace={!inTask} />
      <div className="topbar__machine"><span className="topbar__label">{t('machine')}</span> {machine}</div>
      <div className="topbar__notices">
        {apiMode === 'fixture' && (
          <span className="badge badge--offline" data-testid="offline-badge"><WifiOff size={16} aria-hidden="true" /> {t('offlineData')}</span>
        )}
        {fallback && <span className="badge badge--caution" data-testid="fallback-notice">{t('fallbackNotice')}</span>}
      </div>
      <div className="topbar__controls">
        <button type="button" className="tb-btn" onClick={toggleLang} aria-label="Language" data-testid="lang-toggle">
          <Languages size={22} aria-hidden="true" />
          <span className="tb-btn__seg">
            <b className={lang === 'en' ? 'on' : ''}>EN</b><b className={lang === 'hi' ? 'on' : ''}>हिं</b>
          </span>
        </button>
        <button type="button" className="tb-btn" onClick={toggleTheme} aria-label={theme === 'dark' ? 'Light theme' : 'Dark theme'} aria-pressed={theme === 'light'}>
          {theme === 'dark' ? <Sun size={26} aria-hidden="true" /> : <Moon size={26} aria-hidden="true" />}
        </button>
        <button type="button" className={`tb-btn ${quiet ? 'tb-btn--on' : ''}`} onClick={() => setQuiet(!quiet)} aria-label={t('quietMode')} aria-pressed={quiet} data-testid="quiet-toggle">
          {quiet ? <VolumeX size={26} aria-hidden="true" /> : <Volume2 size={26} aria-hidden="true" />}
        </button>
        <Clock />
      </div>
    </header>
  );
}
