// Fixed voice commands only (Saathi is not a chatbot). Text in en or hi -> command id or null.
//
// False-trigger guard: speech recognition in a cab picks up ordinary conversation, so single
// common words ("quiet", "break", "again", "आराम") never trigger a command on their own. Every
// phrase has at least MIN_PHRASE_WORDS words, and if the recogniser reports a confidence
// (SpeechRecognitionAlternative.confidence) below MIN_COMMAND_CONFIDENCE, nothing matches.
// Trade-off: fewer false triggers, slightly less forgiving of casual one-word phrasing.
export const MIN_PHRASE_WORDS = 2;
export const MIN_COMMAND_CONFIDENCE = 0.6;

export const COMMANDS = {
  log_incident: {
    en: ['log incident', 'log an incident', 'report incident', 'report an incident', 'log a problem'],
    hi: ['घटना दर्ज', 'घटना लिखो', 'रिपोर्ट करो', 'ghatna darj', 'report karo'],
  },
  taking_break: {
    en: ['taking a break', 'take a break', 'break time', 'need a break'],
    hi: ['आराम करना', 'आराम का समय', 'ब्रेक लेना', 'ब्रेक चाहिए', 'aaram karna', 'break lena'],
  },
  quiet_mode: {
    en: ['quiet mode', 'be quiet', 'quiet please', 'silence please'],
    hi: ['शांत मोड', 'चुप रहो', 'चुप हो जाओ', 'shant mode', 'chup raho'],
  },
  repeat: {
    en: ['say again', 'say that again', 'repeat that', 'repeat please', 'come again'],
    hi: ['फिर से', 'दोबारा बोलो', 'dobara bolo', 'phir se'],
  },
};

const wordCount = (phrase) => phrase.trim().split(/\s+/).length;

// Longest phrase wins, so "log incident" beats a shorter phrase inside the same sentence.
// Phrases shorter than MIN_PHRASE_WORDS are ignored even if someone adds one to the lists.
const PHRASES = Object.entries(COMMANDS)
  .flatMap(([id, langs]) => [...langs.en, ...langs.hi].map((phrase) => ({ id, phrase })))
  .filter(({ phrase }) => wordCount(phrase) >= MIN_PHRASE_WORDS)
  .sort((a, b) => b.phrase.length - a.phrase.length);

const isLatin = (s) => /^[a-z ]+$/.test(s);

function normalize(text) {
  const cleaned = String(text ?? '').toLowerCase().replace(/[.,!?।]/g, ' ').replace(/\s+/g, ' ').trim();
  return ` ${cleaned} `;
}

// confidence: optional 0..1 from the recogniser. Missing or 0 (some browsers always report 0)
// means "unknown" and only the phrase rules apply.
export function matchCommand(text, { confidence } = {}) {
  if (typeof confidence === 'number' && confidence > 0 && confidence < MIN_COMMAND_CONFIDENCE) return null;
  const t = normalize(text);
  for (const { id, phrase } of PHRASES) {
    // Latin phrases must match whole words; Devanagari phrases match as substrings.
    if (isLatin(phrase) ? t.includes(` ${phrase} `) : t.includes(phrase)) return id;
  }
  return null;
}
