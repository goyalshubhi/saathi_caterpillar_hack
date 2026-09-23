// Export frontend/src/voice/templates.js to scripts/out/templates.json so Python can render lines.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TEMPLATES, VOCAB, AND } from '../frontend/src/voice/templates.js';

const outDir = fileURLToPath(new URL('./out/', import.meta.url));
mkdirSync(outDir, { recursive: true });
writeFileSync(`${outDir}templates.json`, JSON.stringify({ templates: TEMPLATES, vocab: VOCAB, and: AND }, null, 2), 'utf8');
console.log(`exported ${Object.keys(TEMPLATES).length} templates -> scripts/out/templates.json`);
