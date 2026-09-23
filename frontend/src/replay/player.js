// Telemetry replay (M8). Turns TelemetryWindow[] into replay events and plays them at a chosen speed.
//
// Event types, emitted per window in this order:
//   tick               every window (carries idle state after this window)
//   idle_start         machine goes idle
//   idle_end           machine stops being idle
//   resume_after_idle  machine works again after an idle stretch (carries seatbelt_status)
//   seatbelt_change    seatbelt status differs from the previous window
//   safety_alert       safety_alert_triggered === 'Yes' (carries proximity_distance_m)

export const WINDOW_SECONDS = 15 * 60;
export const DEFAULT_IDLE_THRESHOLD_MIN = 10; // an active window idling >= this is idle too

export function isIdleWindow(w, idleThresholdMin = DEFAULT_IDLE_THRESHOLD_MIN) {
  return !w.machine_active || w.idling_time_min >= idleThresholdMin;
}

// Pure: returns the events for every window, grouped per window ([[...events of window 0], ...]).
export function detectEvents(windows, { idleThresholdMin = DEFAULT_IDLE_THRESHOLD_MIN } = {}) {
  const groups = [];
  let prev = null;
  let idle = false;
  let idleMinutes = 0;
  windows.forEach((w, index) => {
    const base = { index, timestamp: w.timestamp, window: w };
    const nowIdle = isIdleWindow(w, idleThresholdMin);
    const events = [];
    if (nowIdle && !idle) {
      idleMinutes = 0;
      events.push({ ...base, type: 'idle_start' });
    }
    if (nowIdle) idleMinutes += w.idling_time_min;
    if (!nowIdle && idle) {
      events.push({ ...base, type: 'idle_end', idle_minutes: idleMinutes });
      events.push({ ...base, type: 'resume_after_idle', idle_minutes: idleMinutes, seatbelt_status: w.seatbelt_status });
    }
    if (prev && prev.seatbelt_status !== w.seatbelt_status) {
      events.push({ ...base, type: 'seatbelt_change', from: prev.seatbelt_status, to: w.seatbelt_status, machine_active: w.machine_active });
    }
    if (w.safety_alert_triggered === 'Yes') {
      events.push({ ...base, type: 'safety_alert', proximity_distance_m: w.proximity_distance_m ?? null });
    }
    idle = nowIdle;
    if (!idle) idleMinutes = 0;
    groups.push([{ ...base, type: 'tick', idle, idle_minutes: idleMinutes }, ...events]);
    prev = w;
  });
  return groups;
}

// Plays windows in (scaled) real time. speed = 1, 10, 60 ... or Infinity to run instantly.
// Timers are injectable for tests; runAll() plays everything synchronously.
export function createPlayer(windows, {
  speed = 1,
  onEvent = () => {},
  onDone = () => {},
  idleThresholdMin,
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (id) => clearTimeout(id),
} = {}) {
  const groups = detectEvents(windows, { idleThresholdMin });
  let index = 0;
  let timer = null;
  let playing = false;

  function step() {
    if (index >= groups.length) return false;
    groups[index].forEach((e) => onEvent(e));
    index += 1;
    if (index >= groups.length) {
      playing = false;
      onDone();
    }
    return true;
  }

  function schedule() {
    if (!playing || index >= groups.length) return;
    if (!Number.isFinite(speed)) {
      runAll();
      return;
    }
    const delay = index === 0 ? 0 : (WINDOW_SECONDS / speed) * 1000;
    timer = setTimer(() => {
      timer = null;
      step();
      schedule();
    }, delay);
  }

  function runAll() {
    while (step());
  }

  return {
    play() {
      if (playing) return;
      playing = true;
      schedule();
    },
    pause() {
      playing = false;
      if (timer !== null) clearTimer(timer);
      timer = null;
    },
    setSpeed(s) {
      speed = s;
      if (playing) {
        this.pause();
        this.play();
      }
    },
    step,
    runAll,
    get index() { return index; },
    get done() { return index >= groups.length; },
    get speed() { return speed; },
  };
}
