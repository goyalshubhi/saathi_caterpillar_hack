// Read a Scenario JSON on stdin, run it through the real replay engine (player -> rules)
// and print [{index, timestamp, type, saathi: [SaathiEvent]}] for events that make Saathi speak.
// Usage: node scripts/replay_cli.mjs [lang] < scenario.json
import { readFileSync } from 'node:fs';
import { detectEvents, createRules } from '../frontend/src/replay/index.js';

const lang = process.argv[2] || 'en';
const scenario = JSON.parse(readFileSync(0, 'utf8'));
const rules = createRules({ lang });
const out = [];
for (const e of detectEvents(scenario.windows).flat()) {
  const saathi = rules(e);
  if (saathi.length || e.type !== 'tick') out.push({ index: e.index, timestamp: e.timestamp, type: e.type, saathi });
}
process.stdout.write(JSON.stringify(out));
