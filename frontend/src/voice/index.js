// Saathi voice engine (M5). UI-free ES modules: a React app can import these later.
export { TEMPLATES, VOCAB, LANGS, render, hasTemplate, slotNames } from './templates.js';
export { MODES, modeSettings } from './modes.js';
export { createSpeaker, loadManifest, VOICE_LANGS, MANIFEST_URL } from './speaker.js';
export { createQueue, PRIORITY_ORDER } from './queue.js';
export { COMMANDS, matchCommand } from './commands.js';
