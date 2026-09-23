// Voice incident logging (P1): speech (en-IN / hi-IN) -> POST /incidents/classify -> operator
// confirms (or changes the category) -> logged with source "voice". The fixed voice commands from
// src/voice/commands.js work here too (repeat, quiet mode, taking a break). Without speech
// recognition the operator can type instead.
import { useEffect, useRef, useState } from 'react';
import { Mic, Check, X, Keyboard } from 'lucide-react';
import { matchCommand } from '../voice/index.js';
import { store, useStore } from '../state/store.js';
import { useT } from '../i18n.js';
import { classifyIncident } from '../api.js';
import { logIncident } from '../saathi/actions.js';
import { say, repeat, setQuiet } from '../saathi/voiceRuntime.js';
import { CategoryIcon } from './icons.jsx';
import { INCIDENT_BUTTONS } from './IncidentButtons.jsx';
import { useGo } from './routing.js';

const CATEGORIES = [...INCIDENT_BUTTONS, { category: 'other', label: 'other' }];
const Recognition = () => (typeof window === 'undefined' ? null : window.SpeechRecognition ?? window.webkitSpeechRecognition ?? null);

// Text -> what to do. Exported for tests.
export async function interpret(text) {
  const { category, matched } = await classifyIncident(text);
  if (category !== 'other') return { kind: 'incident', category, matched };
  const command = matchCommand(text);
  if (command === 'log_incident') return { kind: 'ask' };
  if (command) return { kind: 'command', command };
  return { kind: 'incident', category: 'other', matched: [] };
}

export default function VoiceLog() {
  const t = useT();
  const go = useGo();
  const lang = useStore((s) => s.lang);
  const [listening, setListening] = useState(false);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState(null); // { text, category }
  const rec = useRef(null);

  useEffect(() => () => rec.current?.abort?.(), []);

  const say1 = (key) => say({ priority: 'info', mode: 'friendly', message_key: key });

  async function handle(text) {
    if (!text.trim()) return;
    const r = await interpret(text);
    if (r.kind === 'ask') say1('cmd_log_incident');
    else if (r.kind === 'command') {
      if (r.command === 'repeat') repeat();
      if (r.command === 'quiet_mode') {
        const on = !store.get().quiet;
        if (on) say1('cmd_quiet_on');
        setQuiet(on);
        if (!on) say1('cmd_quiet_off');
      }
      if (r.command === 'taking_break') {
        say1('cmd_break');
        go('/break');
      }
    } else setPending({ text, category: r.category });
  }

  function listen() {
    const SR = Recognition();
    if (!SR) {
      setTyping(true);
      return;
    }
    const r = new SR();
    r.lang = lang === 'hi' ? 'hi-IN' : 'en-IN';
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.onresult = (e) => handle(e.results[0][0].transcript);
    r.onerror = () => setTyping(true);
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  }

  async function confirm() {
    const { text, category } = pending;
    setPending(null);
    setDraft('');
    setTyping(false);
    await logIncident(category, 'voice', text);
  }

  return (
    <div className="voice-log">
      <div className="voice-log__controls">
        <button type="button" className={`btn btn--secondary voice-log__mic ${listening ? 'is-listening' : ''}`} onClick={listen} data-testid="voice-log-mic">
          <Mic size={30} aria-hidden="true" /> {listening ? t('listening') : t('speak')}
        </button>
        <button type="button" className="btn btn--icon" onClick={() => setTyping((v) => !v)} aria-label={t('typeInstead')} aria-pressed={typing}>
          <Keyboard size={26} aria-hidden="true" />
        </button>
      </div>

      {typing && !pending && (
        <form className="voice-log__type" onSubmit={(e) => { e.preventDefault(); handle(draft); }}>
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t('typeInstead')} aria-label={t('typeInstead')} data-testid="voice-log-input" />
          <button type="submit" className="btn btn--primary" data-testid="voice-log-submit"><Check size={26} aria-hidden="true" /></button>
        </form>
      )}

      {pending && (
        <div className="confirm" role="dialog" aria-label={t('confirm')} data-testid="voice-confirm">
          <p className="confirm__heard"><span>{t('heard')}:</span> “{pending.text}”</p>
          <div className="confirm__cats">
            {CATEGORIES.map(({ category, label }) => (
              <button key={category} type="button" className={`confirm__cat ${pending.category === category ? 'is-on' : ''}`}
                onClick={() => setPending({ ...pending, category })} aria-pressed={pending.category === category}>
                <CategoryIcon category={category} size={28} /> {t(label)}
              </button>
            ))}
          </div>
          <div className="confirm__actions">
            <button type="button" className="btn btn--secondary btn--lg" onClick={() => setPending(null)}><X size={28} aria-hidden="true" /> {t('cancel')}</button>
            <button type="button" className="btn btn--primary btn--xl" onClick={confirm} data-testid="voice-confirm-log"><Check size={32} aria-hidden="true" /> {t('confirm')}</button>
          </div>
        </div>
      )}
    </div>
  );
}
