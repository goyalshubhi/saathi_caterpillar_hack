// What-if panel (Stage View): change weather, temperature, operator skill and machine age for the
// current task; the Pre-task prediction, top factors and spoken estimate update live from the API.
// New numbers usually have no pre-generated MP3, so the queue log shows them as "browser voice".
import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ChevronDown, FlaskConical, RotateCcw } from 'lucide-react';
import { store, useStore } from '../state/store.js';
import { predictTask, supportsWhatIf } from '../api.js';
import { say } from '../saathi/voiceRuntime.js';
import { operatorPath } from '../components/routing.js';

const WEATHER = ['Sunny', 'Cloudy', 'Rainy', 'Windy'];
const SKILL = ['Beginner', 'Intermediate', 'Expert'];

function useCurrentTask() {
  const { pathname } = useLocation();
  const tasks = useStore((s) => s.tasks);
  const firstId = useStore((s) => s.plan?.tasks_ordered?.[0]);
  const m = operatorPath(pathname).match(/^\/(?:pretask|intask|debrief)\/([^/]+)/);
  const id = m?.[1] ?? firstId;
  return tasks?.find((t) => t.task_id === id) ?? null;
}

function Segmented({ options, value, onChange, label }) {
  return (
    <div className="wi-seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" className={value === o ? 'is-on' : ''} onClick={() => onChange(o)} aria-pressed={value === o}>{o}</button>
      ))}
    </div>
  );
}

export default function WhatIf() {
  const [open, setOpen] = useState(false);
  const [supported, setSupported] = useState(null);
  const task = useCurrentTask();
  const whatIf = useStore((s) => s.whatIf);
  const [edit, setEdit] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    if (open && supported === null) supportsWhatIf().then(setSupported);
  }, [open, supported]);

  // Start from the task as planned whenever the current task changes.
  useEffect(() => {
    if (task) setEdit({ weather: task.weather, temperature_c: task.temperature_c, operator_skill: task.operator_skill, machine_age_yrs: task.machine_age_yrs });
  }, [task?.task_id]); // eslint-disable-line react-hooks/exhaustive-deps

  function change(field, value) {
    const next = { ...edit, [field]: value };
    setEdit(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const edited = { ...task, ...next };
      const pred = await predictTask(edited);
      if (!pred) return;
      store.set({ whatIf: { ...pred, task_id: task.task_id, task: edited } });
      say({
        priority: 'info', mode: 'friendly', message_key: 'pretask_estimate',
        slots: { task_type: edited.task_type, weather: edited.weather, cat_min: Math.round(pred.cat_estimate_min), predicted_min: Math.round(pred.predicted_min) },
      });
    }, 350);
  }

  function reset() {
    clearTimeout(timer.current);
    store.set({ whatIf: null });
    if (task) setEdit({ weather: task.weather, temperature_c: task.temperature_c, operator_skill: task.operator_skill, machine_age_yrs: task.machine_age_yrs });
  }

  const disabled = !supported || !task || !edit;
  return (
    <section className={`uth-section wi ${open ? 'is-open' : ''}`} data-testid="what-if">
      <button type="button" className="wi__toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <FlaskConical size={16} aria-hidden="true" /> What-if · {task ? `${task.task_type} (${task.task_id})` : '—'}
        {whatIf && <span className="wi__live">live</span>}
        <ChevronDown size={16} className="wi__chev" aria-hidden="true" />
      </button>
      {open && edit && (
        <div className="wi__body">
          {supported === false && (
            <p className="wi__note" data-testid="what-if-unavailable">
              Needs <code>POST /predict</code> (a Task in, a Prediction out) in the API — not there yet. Controls are shown so the flow is clear.
            </p>
          )}
          <fieldset disabled={disabled}>
            <label>Weather</label>
            <Segmented label="Weather" options={WEATHER} value={edit.weather} onChange={(v) => change('weather', v)} />
            <label htmlFor="wi-temp">Temperature <b>{edit.temperature_c}°C</b></label>
            <input id="wi-temp" type="range" min="15" max="46" value={edit.temperature_c} onChange={(e) => change('temperature_c', Number(e.target.value))} />
            <label>Operator skill</label>
            <Segmented label="Operator skill" options={SKILL} value={edit.operator_skill} onChange={(v) => change('operator_skill', v)} />
            <label htmlFor="wi-age">Machine age <b>{edit.machine_age_yrs} yrs</b></label>
            <input id="wi-age" type="range" min="1" max="12" value={edit.machine_age_yrs} onChange={(e) => change('machine_age_yrs', Number(e.target.value))} />
          </fieldset>
          <div className="wi__foot">
            {whatIf ? <span className="wi__result">Saathi now expects <b>{Math.round(whatIf.predicted_min)} min</b> (CAT {Math.round(whatIf.cat_estimate_min)})</span> : <span className="uth-empty">Open Pre-task in the tablet to see it update.</span>}
            <button type="button" className="demo-btn" onClick={reset}><RotateCcw size={14} aria-hidden="true" /> Reset</button>
          </div>
        </div>
      )}
    </section>
  );
}
