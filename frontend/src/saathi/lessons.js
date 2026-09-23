// Training Hub library. Every lesson is a spoken template key in src/voice/templates.js.
export const LESSONS = [
  { key: 'lesson_idle_engine_off', art: 'engine', minutes: 1 },
  { key: 'lesson_trench_edge', art: 'trench', minutes: 1 },
  { key: 'lesson_three_points', art: 'ladder', minutes: 1 },
  { key: 'lesson_walkaround', art: 'walkaround', minutes: 1 },
  { key: 'lesson_smooth_cycles', art: 'bucket', minutes: 1 },
  { key: 'lesson_hydration', art: 'water', minutes: 1 },
];

// Behaviour finding -> the lesson that helps with it.
export const FINDING_LESSON = {
  excessive_idling: 'lesson_idle_engine_off',
  fuel_without_work: 'lesson_smooth_cycles',
  unbelted_active: 'lesson_walkaround',
  repeated_alerts: 'lesson_walkaround',
  fatigue_drift: 'lesson_hydration',
};

// Recommended lessons: from behaviour findings first, then from today's conditions.
export function recommendedLessons({ findings = [], weather = [], tasks = [] } = {}) {
  const keys = [];
  const add = (k) => { if (k && !keys.includes(k)) keys.push(k); };
  findings.forEach((f) => add(FINDING_LESSON[f.type]));
  if (tasks.some((t) => t.task_type === 'Trenching') && weather.some((h) => h.rain)) add('lesson_trench_edge');
  if (weather.some((h) => h.temperature_c >= 33)) add('lesson_hydration');
  return keys;
}
