// Saathi voice engine (M5). UI-free ES modules: a React app can import these later.
export { TEMPLATES, VOCAB, LANGS, render, hasTemplate, slotNames } from './templates.js';
export { MODES, modeSettings } from './modes.js';
export { createSpeaker, VOICE_LANGS } from './speaker.js';
export { createQueue, PRIORITY_ORDER } from './queue.js';
export { createBriefingGuard } from './briefing.js';
export { COMMANDS, MIN_COMMAND_CONFIDENCE, MIN_PHRASE_WORDS, matchCommand } from './commands.js';
