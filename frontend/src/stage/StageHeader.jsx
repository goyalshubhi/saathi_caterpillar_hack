// Stage View header: demo controls (D / Space / ← →), step pills, pace, Stage/operator toggle (S).
import { useLocation, useNavigate } from 'react-router-dom';
import { Clapperboard, Pause, Play, SkipBack, SkipForward, Maximize2, Workflow, FlaskConical, Square } from 'lucide-react';
import { useStore } from '../state/store.js';
import { DEMO_STEPS, startDemo, togglePause, prevStep, nextStep, goToStep, setPace, stopDemo } from '../demo/demo.js';
import { operatorPath } from '../components/routing.js';
import Avatar from '../avatar/Avatar.jsx';

export default function StageHeader() {
  const demo = useStore((s) => s.demo);
  const speaking = useStore((s) => Boolean(s.speaking));
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const current = DEMO_STEPS[demo.step - 1];

  return (
    <header className="stage-header" data-testid="stage-header">
      <div className="stage-header__brand">
        <Avatar state={speaking ? 'speaking' : 'idle'} size={40} testId="stage-avatar" />
        <div>
          <b>Saathi</b>
          <span>Stage View</span>
        </div>
        <span className="badge badge--sim" data-testid="sim-badge"><FlaskConical size={14} aria-hidden="true" /> Simulated data</span>
      </div>

      <div className="demo-bar" role="group" aria-label="Demo controls">
        {!demo.running ? (
          <button type="button" className="demo-btn demo-btn--start" onClick={() => startDemo()} data-testid="start-demo">
            <Clapperboard size={18} aria-hidden="true" /> {demo.done ? 'Replay demo' : 'Start demo'} <kbd>D</kbd>
          </button>
        ) : (
          <>
            <button type="button" className="demo-btn" onClick={prevStep} aria-label="Previous step" title="Previous step"><SkipBack size={18} aria-hidden="true" /></button>
            <button type="button" className="demo-btn" onClick={togglePause} data-testid="demo-pause" aria-label={demo.paused ? 'Resume' : 'Pause'} title={demo.paused ? 'Resume' : 'Pause'}>
              {demo.paused ? <Play size={18} aria-hidden="true" /> : <Pause size={18} aria-hidden="true" />} <kbd>Space</kbd>
            </button>
            <button type="button" className="demo-btn" onClick={nextStep} aria-label="Next step" title="Next step"><SkipForward size={18} aria-hidden="true" /></button>
            <button type="button" className="demo-btn" onClick={stopDemo} aria-label="Stop demo" title="Stop demo"><Square size={16} aria-hidden="true" /></button>
          </>
        )}
        <ol className="step-pills">
          {DEMO_STEPS.map((s) => (
            <li key={s.n}>
              <button type="button" onClick={() => goToStep(s.n)} title={s.title} data-testid={`step-${s.n}`}
                className={`step-pill ${demo.step === s.n ? (demo.running ? 'is-current' : 'is-last') : ''} ${demo.step > s.n || demo.done ? 'is-past' : ''}`}>
                <b>{s.n}</b><span>{s.short}</span>
              </button>
            </li>
          ))}
        </ol>
        <div className="pace" role="group" aria-label="Pace">
          {['normal', 'max'].map((p) => (
            <button key={p} type="button" className={demo.pace === p ? 'is-on' : ''} onClick={() => setPace(p)} data-testid={`pace-${p}`} aria-pressed={demo.pace === p} title={p === 'normal' ? 'Demo at normal pace' : 'Demo at max pace (silent)'}>
              {p === 'normal' ? 'Normal' : 'Max'}
            </button>
          ))}
        </div>
      </div>

      <div className="stage-header__right">
        <span className="stage-header__now" data-testid="demo-status">
          {demo.running ? `${demo.paused ? 'Paused · ' : ''}Step ${demo.step}: ${current?.title ?? ''}` : demo.done ? 'Demo complete' : 'Ready'}
        </span>
        <button type="button" className="demo-btn" onClick={() => navigate('/architecture')}><Workflow size={18} aria-hidden="true" /> Architecture</button>
        <button type="button" className="demo-btn" onClick={() => navigate(`${operatorPath(pathname)}${search}`)} data-testid="toggle-operator">
          <Maximize2 size={18} aria-hidden="true" /> Operator <kbd>S</kbd>
        </button>
      </div>
    </header>
  );
}
