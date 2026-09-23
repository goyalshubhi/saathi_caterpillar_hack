// Architecture: animated data flow, all on the device in the cab. During the demo, the stage the
// flow is passing through lights up (store.arch is set by the API wrapper, replay and voice runtimes).
import { useNavigate } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Clapperboard } from 'lucide-react';
import { useStore } from '../state/store.js';
import { startDemo } from '../demo/demo.js';

export const ARCH_NODES = [
  { id: 'telemetry', label: 'Machine telemetry', sub: '15-min windows', keys: ['telemetry'] },
  { id: 'replay', label: 'Replay / ingest', sub: 'idle · belt · alerts', keys: ['replay'] },
  { id: 'brain', label: 'Rules + ML models', sub: 'estimate · split · findings', keys: ['rules', 'models'] },
  { id: 'planner', label: 'Planner', sub: 'order · breaks · warnings', keys: ['planner'] },
  { id: 'queue', label: 'Voice queue', sub: 'safety first · budget', keys: ['queue'] },
  { id: 'saathi', label: 'Saathi', sub: 'voice + captions', keys: ['saathi'] },
];

const W = 1400;
const NODE_W = 200;
const GAP = (W - 40 - NODE_W * ARCH_NODES.length) / (ARCH_NODES.length - 1);
const nodeX = (i) => 20 + i * (NODE_W + GAP);
const MEM_RIGHT = nodeX(3) + NODE_W - 40;

// Compact strip for the Stage View panel: same stages as chips, readable at panel size.
function ArchitectureStrip({ activeIndex, n }) {
  return (
    <div className="arch arch--compact" data-testid="arch-compact">
      <p className="arch__strip-label">On the device · in the cab</p>
      <ol className="arch__strip">
        {ARCH_NODES.map((node, i) => (
          <li key={node.id} className={i === activeIndex ? 'is-on' : ''} data-active={i === activeIndex || undefined}>
            {i === activeIndex ? <motion.span key={n} initial={{ scale: 1.15 }} animate={{ scale: 1 }} transition={{ duration: 0.25 }}>{node.label}</motion.span> : <span>{node.label}</span>}
          </li>
        ))}
      </ol>
      <p className="arch__note">No data leaves the cab except confirmed incident records — never an operator ID.</p>
    </div>
  );
}

export function ArchitectureDiagram({ compact = false }) {
  const arch = useStore((s) => s.arch);
  const reduce = useReducedMotion();
  const activeIndex = ARCH_NODES.findIndex((n) => n.keys.includes(arch.stage));
  if (compact) return <ArchitectureStrip activeIndex={activeIndex} n={arch.n} />;
  const y = 120;
  const h = 110;
  const H = 380;
  const midY = y + h / 2;

  return (
    <div className="arch" data-testid="arch-diagram">
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Data flow: machine telemetry, replay, rules and ML models, planner, voice queue, Saathi — all on the device">
        {/* on-device boundary */}
        <rect x="6" y="70" width={W - 12} height="220" rx="18" className="arch__boundary" />
        <text x="24" y="98" className="arch__boundary-label">ON THE DEVICE · IN THE CAB</text>

        {/* edges */}
        {ARCH_NODES.slice(1).map((n, i) => {
          const x1 = nodeX(i) + NODE_W;
          const x2 = nodeX(i + 1);
          const hot = activeIndex === i + 1;
          return (
            <g key={`e-${n.id}`}>
              <line x1={x1} y1={midY} x2={x2 - 8} y2={midY} className={`arch__edge ${hot ? 'is-hot' : ''}`} />
              <path d={`M${x2 - 12} ${midY - 7} L${x2 - 2} ${midY} L${x2 - 12} ${midY + 7}`} className={`arch__head ${hot ? 'is-hot' : ''}`} />
              {!reduce && (
                <motion.circle r={hot ? 6 : 3.5} cy={midY} className={`arch__dot ${hot ? 'is-hot' : ''}`}
                  initial={{ cx: x1 }} animate={{ cx: [x1, x2 - 6] }}
                  transition={{ duration: hot ? 0.6 : 1.8, repeat: Infinity, ease: 'linear', delay: i * 0.3 }} />
              )}
            </g>
          );
        })}

        {/* nodes */}
        {ARCH_NODES.map((n, i) => {
          const on = i === activeIndex;
          return (
            <g key={n.id} data-active={on || undefined}>
              {on && !reduce && (
                <motion.rect key={arch.n} x={nodeX(i) - 6} y={y - 6} width={NODE_W + 12} height={h + 12} rx="20" className="arch__glow"
                  initial={{ opacity: 0.9 }} animate={{ opacity: 0.25 }} transition={{ duration: 0.9 }} />
              )}
              <rect x={nodeX(i)} y={y} width={NODE_W} height={h} rx="14" className={`arch__node ${on ? 'is-on' : ''} ${n.id === 'saathi' ? 'arch__node--saathi' : ''}`} />
              <text x={nodeX(i) + NODE_W / 2} y={y + 50} className="arch__label" textAnchor="middle">{n.label}</text>
              <text x={nodeX(i) + NODE_W / 2} y={y + 80} className="arch__sub" textAnchor="middle">{n.sub}</text>
            </g>
          );
        })}

        <g>
          {/* the only thing that leaves the cab */}
          <path d={`M${nodeX(5) + NODE_W / 2} ${y + h} V ${330} H ${MEM_RIGHT + 4}`} className="arch__out" />
          <path d={`M${MEM_RIGHT + 14} 323 L${MEM_RIGHT + 4} 330 L${MEM_RIGHT + 14} 337`} className="arch__out" />
          <rect x={nodeX(2)} y="306" width={MEM_RIGHT - nodeX(2)} height="48" rx="12" className="arch__memory" />
          <text x={nodeX(2) + 18} y="336" className="arch__memory-label">Machine Memory · next shift</text>
          <text x={nodeX(4) + 10} y="322" className="arch__out-label">confirmed incident records only</text>
        </g>
      </svg>
      <p className="arch__note">No data leaves the cab except confirmed incident records — never an operator ID.</p>
    </div>
  );
}

export default function ArchitecturePage() {
  const navigate = useNavigate();
  return (
    <div className="arch-page" data-testid="screen-architecture">
      <header className="arch-page__head">
        <button type="button" className="demo-btn" onClick={() => navigate('/stage')}><ArrowLeft size={16} aria-hidden="true" /> Stage View</button>
        <h1>How Saathi works</h1>
        <span className="badge badge--sim">Simulated data</span>
        <button type="button" className="demo-btn demo-btn--start" onClick={() => { navigate('/stage'); startDemo(); }}>
          <Clapperboard size={16} aria-hidden="true" /> Start demo
        </button>
      </header>
      <ArchitectureDiagram />
      <ul className="arch-page__points">
        <li><b>Telemetry</b> arrives as 15-minute windows (the brief's machine_usage schema plus proximity). The demo replays a synthetic shift.</li>
        <li><b>Rules</b> turn events into safety lines (belt before you move, proximity). <b>ML</b> estimates task time and splits an overrun into conditions vs idle gaps. Saathi does not detect work cycles in real time.</li>
        <li><b>Planner</b> orders the day around heat and adds breaks and condition warnings.</li>
        <li><b>Voice queue</b>: safety interrupts, one coaching line per task, quiet mode never mutes safety. Pre-generated neural voice, browser voice as fallback.</li>
      </ul>
    </div>
  );
}
