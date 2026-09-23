// Contract examples bundled into the app: the data used in FIXTURE mode (API unreachable) and in tests.
import tasksToday from '../../contracts/examples/tasks_today.json';
import weatherToday from '../../contracts/examples/weather_today.json';
import dayPlan from '../../contracts/examples/day_plan.json';
import prediction from '../../contracts/examples/prediction.json';
import debrief from '../../contracts/examples/debrief.json';
import findings from '../../contracts/examples/behavior_findings.json';
import scenarioDemo from '../../contracts/examples/scenario_demo.json';
import incident from '../../contracts/examples/incident.json';
import memoryNote from '../../contracts/examples/memory_note.json';

export const FIXTURES = { tasksToday, weatherToday, dayPlan, prediction, debrief, findings, scenarioDemo, incident, memoryNote };

const copy = (x) => JSON.parse(JSON.stringify(x));
export const fixture = (name) => copy(FIXTURES[name]);
