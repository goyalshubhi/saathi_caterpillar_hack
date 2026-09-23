// "Under the hood" panel for judges, in sync with the operator app: telemetry stream, replay events,
// model outputs and every voice-queue decision.
import { AnimatePresence, motion } from 'framer-motion';
import { Radio, Zap, BrainCircuit, AudioLines } from 'lucide-react';
import { variantCount } from '../voice/index.js';
import { useStore } from '../state/store.js';
import { debriefSplit } from '../saathi/briefings.js';
import { factorLabel, findingTitle } from '../i18n.js';
import WhatIf from './WhatIf.jsx';
import { ArchitectureDiagram } from './ArchitecturePage.jsx';

const EVENT_TYPES = [
  ['idle_start', 'Idle start'],
  ['idle_end', 'Idle end'],
  ['resume_after_idle', 'Resume after idle'],
  ['seatbelt_change', 'Seatbelt change'],
  ['safety_alert', 'Safety alert'],
];

const DECISION = {
  spoken: ['spoken', 'ok'],
  'held-budget': ['held — coaching budget used', 'held'],
  'held-quiet': ['held — muted', 'held'],
  muted: ['cut — muted', 'cut'],
  preempted: ['preempted by safety', 'cut'],
};

const SOURCE = { audio: 'MP3', tts: 'browser voice', silent: 'silent' };

const rowIn = { initial: { opacity: 0, y: -10, backgroundColor: 'rgba(255,205,17,0.18)' }, animate: { opacity: 1, y: 0, backgroundColor: 'rgba(255,205,17,0)' }, transition: { duration: 0.6 } };

function Section({ icon: Icon, title, children, className = '', testid }) {
  return (
    <section className={`uth-section ${className}`} data-testid={testid}>
      <h3 className="uth-section__title"><Icon size={16} aria-hidden="true" /> {title}</h3>
      {children}
    </section>
  );
}

function Telemetry() {
  const rows = useStore((s) => s.log.telemetry);
  return (
    <Section icon={Radio} title="Telemetry stream · 15-min windows" testid="uth-telemetry">
      <div className="tele">
        <div className="tele__row tele__row--head"><span>time</span><span>cyc</span><span>idle</span><span>belt</span><span>prox</span><span>alert</span></div>
        <AnimatePresence initial={false}>
          {rows.slice(0, 9).map((r) => (
            <motion.div key={r.id} className={`tele__row ${r.alert === 'Yes' ? 'is-alert' : ''} ${!r.active ? 'is-idle' : ''}`} {...rowIn}>
              <span>{r.time}</span>
              <span>{r.cycles}</span>
              <span>{r.idle}m</span>
              <span className={r.belt === 'Fastened' ? 'ok' : 'bad'}>{r.belt === 'Fastened' ? 'on' : 'OFF'}</span>
              <span>{r.proximity == null ? '—' : `${r.proximity}m`}</span>
              <span className={r.alert === 'Yes' ? 'bad' : ''}>{r.alert === 'Yes' ? 'YES' : '—'}</span>
            </motion.div>
          ))}
        </AnimatePresence>
        {!rows.length && <p className="uth-empty">Waiting for the in-task replay…</p>}
      </div>
    </Section>
  );
}

function Events() {
  const fired = useStore((s) => s.firedEvents);
  const events = useStore((s) => s.log.events);
  const latest = events[0]?.type;
  return (
    <Section icon={Zap} title="Replay events" testid="uth-events">
      <div className="ev-pills">
        {EVENT_TYPES.map(([type, label]) => (
          <motion.span key={`${type}-${fired[type] ?? 0}`} className={`ev-pill ev-pill--${type} ${fired[type] ? 'is-fired' : ''} ${latest === type ? 'is-latest' : ''}`}
            initial={fired[type] ? { scale: 1.12 } : false} animate={{ scale: 1 }} transition={{ duration: 0.25 }}>
            {label}{fired[type] ? <b>{fired[type]}</b> : null}
          </motion.span>
        ))}
      </div>
      <ol className="ev-list">
        <AnimatePresence initial={false}>
          {events.slice(0, 4).map((e) => (
            <motion.li key={e.id} {...rowIn}><span className="mono">{e.time}</span> {e.type.replaceAll('_', ' ')} <em>{e.detail}</em></motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </Section>
  );
}

function Models() {
  const model = useStore((s) => s.log.model);
  const debrief = useStore((s) => s.debrief);
  const findings = useStore((s) => s.findings);
  const fatigue = useStore((s) => s.fatigue);
  const tasks = useStore((s) => s.tasks);
  const pred = model.find((m) => m.kind === 'prediction')?.data;
  const whatIf = model.find((m) => m.kind === 'prediction')?.whatIf;
  const split = debrief ? debriefSplit(debrief) : null;
  const task = tasks?.find((x) => x.task_id === pred?.task_id);
  const maxF = Math.max(1, ...(pred?.top_factors ?? []).map((f) => f.minutes));

  return (
    <Section icon={BrainCircuit} title="Model outputs" className="uth-models" testid="uth-models">
      <div className="mo-grid">
        <div className="mo-card">
          <span className="mo-card__label">Prediction {pred ? `· ${task?.task_type ?? pred.task_id}` : ''}{whatIf ? ' · what-if' : ''}</span>
          {pred ? (
            <>
              <p className="mo-pred"><span className="mo-pred__cat">CAT {Math.round(pred.cat_estimate_min)}</span> → <b key={pred.predicted_min}>{Math.round(pred.predicted_min)} min</b></p>
              <ul className="mo-factors">
                {pred.top_factors.filter((f) => f.minutes > 0).map((f) => (
                  <li key={f.name}>
                    <span>{factorLabel(f.name, 'en')}</span>
                    <span className="mo-factors__track"><motion.span initial={{ width: 0 }} animate={{ width: `${(f.minutes / maxF) * 100}%` }} transition={{ duration: 0.5 }} /></span>
                    <span className="mono">+{Math.round(f.minutes)}</span>
                  </li>
                ))}
              </ul>
            </>
          ) : <p className="uth-empty">—</p>}
        </div>
        <div className="mo-card">
          <span className="mo-card__label">Counterfactual split</span>
          {split && split.over > 0 ? (
            <>
              <div className="mo-split" data-testid="uth-split">
                <motion.span className="mo-split__u" initial={{ width: 0 }} animate={{ width: `${(split.uncontrollable / split.over) * 100}%` }} transition={{ duration: 0.8 }}>{split.uncontrollable}</motion.span>
                <motion.span className="mo-split__c" initial={{ width: 0 }} animate={{ width: `${(split.controllable / split.over) * 100}%` }} transition={{ duration: 0.8, delay: 0.5 }}>{split.controllable}</motion.span>
              </div>
              <p className="mo-note">{split.over} min over = {split.uncontrollable} conditions + {split.controllable} idle gaps</p>
            </>
          ) : <p className="uth-empty">after the task</p>}
        </div>
        <div className="mo-card">
          <span className="mo-card__label">Behaviour findings</span>
          <div className="mo-chips">
            <AnimatePresence>
              {(findings ?? []).map((f, i) => (
                <motion.span key={`${f.type}-${f.window_timestamp}`} className={`mo-chip mo-chip--${f.severity}`}
                  initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.2, delay: i * 0.12 }}>
                  {findingTitle(f.type, 'en')}
                </motion.span>
              ))}
            </AnimatePresence>
            {!findings && <p className="uth-empty">after the task</p>}
          </div>
        </div>
        <div className="mo-card">
          <span className="mo-card__label">Fatigue drift</span>
          <div className="mo-fatigue">
            <div className="mo-fatigue__track">
              <motion.span animate={{ width: fatigue ? '86%' : '0%' }} transition={{ duration: 1.2 }} className={fatigue ? 'is-on' : ''} />
            </div>
            <p className="mo-note">{fatigue ? 'drift detected → care break' : fatigue === false ? 'model not available yet (stand-ins)' : 'checked in step 7'}</p>
          </div>
        </div>
      </div>
    </Section>
  );
}

function VoiceQueue() {
  const entries = useStore((s) => s.log.queue);
  return (
    <Section icon={AudioLines} title="Voice queue decisions" className="uth-queue" testid="uth-queue">
      <ol className="vq">
        <AnimatePresence initial={false}>
          {entries.slice(0, 14).map((q) => {
            const [label, tone] = DECISION[q.decision] ?? [q.decision, 'ok'];
            const n = variantCount(q.event.message_key);
            return (
              <motion.li key={q.id} className={`vq__row vq__row--${tone}`} data-testid="vq-row" {...rowIn}>
                <span className={`vq__badge vq__badge--${tone}`}>{label}</span>
                <span className="vq__key mono">{q.event.message_key}</span>
                <span className={`vq__prio vq__prio--${q.event.priority}`}>{q.event.priority}</span>
                {q.decision === 'spoken' && (
                  <span className="vq__meta">
                    {n > 1 ? `phrasing ${q.variant + 1}/${n}` : 'fixed phrasing'} · <b className={q.source === 'audio' ? 'src-mp3' : 'src-tts'}>{SOURCE[q.source] ?? q.source}</b> · {q.lang}
                  </span>
                )}
                {q.decision === 'preempted' && <span className="vq__meta">cut by {q.by}</span>}
                {q.text && <span className="vq__text">{q.text}</span>}
              </motion.li>
            );
          })}
        </AnimatePresence>
        {!entries.length && <li className="uth-empty">Nothing said yet. Press D to start the demo.</li>}
      </ol>
    </Section>
  );
}

export default function UnderTheHood() {
  return (
    <aside className="uth" aria-label="Under the hood" data-testid="under-the-hood">
      <div className="uth__head">
        <h2>Under the hood</h2>
        <span className="badge badge--sim">Simulated data</span>
      </div>
      <ArchitectureDiagram compact />
      <div className="uth__row">
        <Telemetry />
        <Events />
      </div>
      <Models />
      <VoiceQueue />
      <WhatIf />
    </aside>
  );
}
