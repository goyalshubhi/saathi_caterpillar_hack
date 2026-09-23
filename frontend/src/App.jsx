// App shell. The operator app is always mounted at the same place in the tree; the Stage View only
// adds its header and "Under the hood" panel around it and shrinks it into a tablet frame, so
// toggling Stage View (S) never restarts a screen, a replay or the voice.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { useStore } from './state/store.js';
import { detectMode } from './api.js';
import { initVoice } from './saathi/voiceRuntime.js';
import { registerNavigator, startDemo, togglePause, nextStep, prevStep } from './demo/demo.js';
import { isStagePath, operatorPath, STAGE } from './components/routing.js';
import TopBar from './components/TopBar.jsx';
import NavRail from './components/NavRail.jsx';
import { Caption, StartOverlay } from './components/Overlays.jsx';
import Morning from './screens/Morning.jsx';
import PreTask from './screens/PreTask.jsx';
import InTask from './screens/InTask.jsx';
import Break from './screens/Break.jsx';
import Debrief from './screens/Debrief.jsx';
import TrainingHub from './screens/TrainingHub.jsx';
import Incidents from './screens/Incidents.jsx';
import About from './screens/About.jsx';
import StageHeader from './stage/StageHeader.jsx';
import UnderTheHood from './stage/UnderTheHood.jsx';
import ArchitecturePage from './stage/ArchitecturePage.jsx';

export const DEVICE_W = 1280;
export const DEVICE_H = 800;

const screenMotion = {
  initial: { opacity: 0, x: 18 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -12 },
  transition: { duration: 0.2, ease: 'easeOut' },
};
const still = { initial: false, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, transition: { duration: 0 } } };

function ShiftOverlay() {
  const overlay = useStore((s) => s.demo.overlay);
  return (
    <AnimatePresence>
      {overlay === 'shift2' && (
        <motion.div className="shift-overlay" data-testid="shift2-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <p className="eyebrow">Shift 2</p>
          <h2 className="display">New operator, same machine</h2>
          <p>EXC001 · the incident logged last shift travels with the machine, not the person.</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function OperatorApp() {
  const location = useLocation();
  const theme = useStore((s) => s.theme);
  const stage = isStagePath(location.pathname);
  const opPath = operatorPath(location.pathname);
  const inTask = opPath.startsWith('/intask');
  const onBreak = opPath.startsWith('/break');
  const routeLocation = { ...location, pathname: opPath };
  const m = inTask ? still : screenMotion;

  return (
    <div className={`op-app ${inTask ? 'op-app--intask' : ''} ${onBreak ? 'op-app--break' : ''}`} data-theme={theme} data-screen={opPath.split('/')[1]} data-testid="operator-app">
      <TopBar inTask={inTask} />
      {!inTask && <NavRail />}
      <main className="op-main">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={opPath} className="op-screen" {...m}>
            <Routes location={routeLocation}>
              <Route path="/morning" element={<Morning />} />
              <Route path="/pretask/:taskId" element={<PreTask />} />
              <Route path="/intask/:taskId" element={<InTask />} />
              <Route path="/break" element={<Break />} />
              <Route path="/debrief/:taskId" element={<Debrief />} />
              <Route path="/hub" element={<TrainingHub />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="/about" element={<About />} />
              <Route path="*" element={<Navigate to={stage ? `${STAGE}/morning` : '/morning'} replace />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
      {/* Morning shows the caption inline, next to the avatar */}
      {!opPath.startsWith('/morning') && <Caption still={inTask} />}
      <ShiftOverlay />
    </div>
  );
}

// Full screen: the operator app fills the viewport. Stage View: a 1280x800 tablet scaled to fit.
function DeviceFrame({ enabled, children }) {
  const outer = useRef(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    if (!enabled || !outer.current) return undefined;
    const el = outer.current;
    const fit = () => {
      const pad = 36; // bezel
      const s = Math.min((el.clientWidth - pad) / DEVICE_W, (el.clientHeight - pad) / DEVICE_H);
      setScale(Math.max(0.3, Math.min(s, 1.5)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [enabled]);
  const screenStyle = enabled ? { width: DEVICE_W, height: DEVICE_H, transform: `scale(${scale})` } : undefined;
  const bezelStyle = enabled ? { width: DEVICE_W * scale + 28, height: DEVICE_H * scale + 28 } : undefined;
  return (
    <div ref={outer} className={`device ${enabled ? 'device--framed' : 'device--full'}`}>
      <div className="device__bezel" style={bezelStyle}>
        <div className="device__screen" style={screenStyle}>{children}</div>
      </div>
    </div>
  );
}

function useKeyboard() {
  const navigate = useNavigate();
  const location = useLocation();
  const loc = useRef(location);
  loc.current = location;
  useEffect(() => {
    function onKey(e) {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target.closest?.('input, select, textarea, [contenteditable]')) return;
      const { pathname, search } = loc.current;
      if (e.key === 'd' || e.key === 'D') startDemo();
      else if (e.key === 's' || e.key === 'S') {
        const op = operatorPath(pathname);
        navigate(isStagePath(pathname) ? `${op}${search}` : `${STAGE}${op}${search}`);
      } else if (e.key === ' ') {
        if (e.target.closest?.('button')) return; // Space activates the focused button instead
        e.preventDefault();
        togglePause();
      } else if (e.key === 'ArrowRight') nextStep();
      else if (e.key === 'ArrowLeft') prevStep();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate]);
}

function DemoBridge() {
  const navigate = useNavigate();
  const location = useLocation();
  const loc = useRef(location);
  loc.current = location;
  useEffect(() => {
    registerNavigator((path) => navigate(isStagePath(loc.current.pathname) ? `${STAGE}${path}` : path));
  }, [navigate]);
  return null;
}

export function Shell() {
  const { pathname } = useLocation();
  const stage = isStagePath(pathname);
  useKeyboard();
  return (
    <div className={`shell ${stage ? 'shell--stage' : 'shell--full'}`}>
      {stage && <StageHeader />}
      <DeviceFrame enabled={stage}>
        <OperatorApp />
        <StartOverlay />
      </DeviceFrame>
      {stage && <UnderTheHood />}
      <DemoBridge />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    detectMode();
    initVoice();
  }, []);
  return (
    <MotionConfig reducedMotion="user">
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/architecture" element={<ArchitecturePage />} />
          <Route path="*" element={<Shell />} />
        </Routes>
      </BrowserRouter>
    </MotionConfig>
  );
}
