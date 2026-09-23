// Fixed voice commands only (Saathi is not a chatbot). Text in en or hi -> command id or null.
export const COMMANDS = {
  log_incident: {
    en: ['log incident', 'log an incident', 'report incident', 'report an incident', 'incident'],
    hi: ['घटना दर्ज', 'घटना', 'रिपोर्ट', 'ghatna darj', 'ghatna'],
  },
  taking_break: {
    en: ['taking a break', 'take a break', 'break time', 'break'],
    hi: ['आराम', 'ब्रेक', 'aaram', 'aram'],
  },
  quiet_mode: {
    en: ['quiet mode', 'be quiet', 'quiet', 'silence'],
    hi: ['शांत', 'चुप', 'shant', 'chup'],
  },
  repeat: {
    en: ['repeat', 'say again', 'say that again', 'again'],
    hi: ['दोबारा', 'फिर से', 'dobara', 'phir se'],
  },
};

// Longest phrase wins, so "log incident" beats a shorter phrase inside the same sentence.
const PHRASES = Object.entries(COMMANDS)
  .flatMap(([id, langs]) => [...langs.en, ...langs.hi].map((phrase) => ({ id, phrase })))
  .sort((a, b) => b.phrase.length - a.phrase.length);

const isLatin = (s) => /^[a-z ]+$/.test(s);

function normalize(text) {
  const cleaned = String(text ?? '').toLowerCase().replace(/[.,!?।]/g, ' ').replace(/\s+/g, ' ').trim();
  return ` ${cleaned} `;
}

export function matchCommand(text) {
  const t = normalize(text);
  for (const { id, phrase } of PHRASES) {
    // Latin phrases must match whole words; Devanagari phrases match as substrings.
    if (isLatin(phrase) ? t.includes(` ${phrase} `) : t.includes(phrase)) return id;
  }
  return null;
}
