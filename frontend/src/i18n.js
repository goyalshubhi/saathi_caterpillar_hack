// Short on-screen labels in English and Hindi. Spoken lines live in src/voice/templates.js.
// NOTE: Hindi labels need the same native-speaker review as the voice templates.
import { useStore } from './state/store.js';

const L = {
  today: ['Today', 'आज'],
  training: ['Training', 'सीखें'],
  incidents: ['Incidents', 'घटनाएँ'],
  about: ['About', 'जानकारी'],
  goodMorning: ['Good morning', 'सुप्रभात'],
  shift: ['Shift', 'शिफ्ट'],
  machine: ['Machine', 'मशीन'],
  conditions: ['Today’s conditions', 'आज का मौसम'],
  tasks: ['Today’s tasks', 'आज के काम'],
  suggestedOrder: ['Suggested order', 'सुझाया गया क्रम'],
  breaks: ['Breaks', 'आराम'],
  lastShift: ['Last shift says…', 'पिछली शिफ्ट ने कहा…'],
  noNotes: ['No notes from the last shift', 'पिछली शिफ्ट से कोई संदेश नहीं'],
  startTask: ['Start task', 'काम शुरू करें'],
  opensBriefing: ['Plays the pre-task briefing first', 'पहले काम की जानकारी सुनाएगा'],
  briefNextTip: ['Opens the pre-task briefing for the next task: Saathi’s time estimate and safety warnings', 'अगले काम की जानकारी खोलें: साथी का अनुमान और सुरक्षा चेतावनी'],
  startThisTaskTip: ['Starts this task now: opens the in-task screen and Saathi follows the machine', 'यह काम अभी शुरू करें: काम की स्क्रीन खुलेगी'],
  backToToday: ['Back to today’s tasks', 'आज के कामों पर वापस'],
  demoStepOf: ['Step {n} of {total}', '{total} में से चरण {n}'],
  demoNext: ['Next', 'अगला'],
  demoPaused: ['Paused', 'रुका हुआ'],
  beginWork: ['Begin work', 'काम चालू करें'],
  startDemo: ['Start demo', 'डेमो शुरू करें'],
  catEstimate: ['CAT estimate', 'CAT अनुमान'],
  saathiExpects: ['Saathi expects', 'साथी का अनुमान'],
  min: ['min', 'मिनट'],
  whyLonger: ['Why it takes longer', 'समय ज़्यादा क्यों'],
  safetyToday: ['Safety for this task', 'इस काम की सुरक्षा'],
  noWarnings: ['No special conditions', 'कोई ख़ास स्थिति नहीं'],
  back: ['Back', 'वापस'],
  working: ['Working', 'काम चालू'],
  idle: ['Idle', 'रुका हुआ'],
  elapsed: ['Elapsed', 'बीता समय'],
  of: ['of', 'में से'],
  nearMiss: ['Near miss', 'बाल-बाल बचे'],
  personInZone: ['Person in zone', 'क्षेत्र में व्यक्ति'],
  machineIssue: ['Machine issue', 'मशीन ख़राबी'],
  other: ['Other', 'अन्य'],
  logged: ['Logged', 'दर्ज हुआ'],
  finishTask: ['Finish task', 'काम पूरा'],
  taskDone: ['Task done', 'काम पूरा हुआ'],
  overEstimate: ['over the CAT estimate', 'CAT अनुमान से ज़्यादा'],
  onTime: ['On time', 'समय पर'],
  notYourControl: ['Not in your control', 'आपके बस में नहीं'],
  yoursToWin: ['Yours to win back', 'आप बचा सकते हैं'],
  whatWeNoticed: ['What Saathi noticed', 'साथी ने क्या देखा'],
  openHub: ['Training', 'सीखें'],
  nextTask: ['Back to today', 'आज की सूची'],
  debriefDone: ['Debrief already reviewed', 'समीक्षा हो चुकी है'],
  recommended: ['Recommended for you', 'आपके लिए सुझाव'],
  library: ['Library', 'पाठ संग्रह'],
  completed: ['Completed', 'पूरे हुए'],
  nothingYet: ['Nothing yet', 'अभी कुछ नहीं'],
  bookInstructor: ['Book an instructor', 'प्रशिक्षक बुक करें'],
  comingSoon: ['Coming soon', 'जल्द आ रहा है'],
  tapToHear: ['Tap to hear', 'सुनने के लिए दबाएँ'],
  logIncident: ['Log an incident', 'घटना दर्ज करें'],
  onThisMachine: ['Logged on this machine', 'इस मशीन पर दर्ज'],
  noIncidents: ['No incidents logged', 'कोई घटना दर्ज नहीं'],
  speak: ['Speak', 'बोलें'],
  micTip: ['Press, then say what happened or a command (repeat, quiet mode, taking a break)', 'दबाएँ, फिर बताएँ क्या हुआ या आदेश बोलें'],
  send: ['Send', 'भेजें'],
  listening: ['Listening', 'सुन रहा हूँ'],
  listeningNow: ['Listening…', 'सुन रहा हूँ…'],
  ready: ['Ready', 'तैयार'],
  muted: ['Muted — safety only', 'चुप — सिर्फ़ सुरक्षा'],
  coachingMute: ['Coaching mute', 'कोचिंग बंद करें'],
  coachingMuted: ['Coaching muted', 'कोचिंग बंद है'],
  muteTip: ['Coaching mute: stops Saathi’s voice now and keeps it silent. Safety alerts still speak.', 'कोचिंग बंद: साथी की आवाज़ अभी रोकें। सुरक्षा चेतावनी फिर भी बोलेगी।'],
  langTip: ['Switch language: English / Hindi', 'भाषा बदलें: अंग्रेज़ी / हिंदी'],
  themeTip: ['Switch between dark and light screen', 'डार्क और लाइट स्क्रीन बदलें'],
  dark: ['Dark', 'डार्क'],
  light: ['Light', 'लाइट'],
  speaking: ['Speaking…', 'बोल रहा हूँ…'],
  quietMode: ['Quiet mode', 'शांत मोड'],
  breakTime: ['Break time', 'आराम का समय'],
  careBreak: ['Rest — you have earned it', 'आराम — आपने कमाया है'],
  next: ['Next', 'अगला'],
  imBack: ['I’m back', 'मैं वापस आ गया'],
  imBackTip: ['Ends the break and returns to today’s tasks', 'आराम ख़त्म, आज के कामों पर वापस'],
  drinkWater: ['Drink a glass of water', 'एक गिलास पानी पिएँ'],
  repeat: ['Repeat', 'दोबारा'],
  confirm: ['Log it', 'दर्ज करें'],
  cancel: ['Cancel', 'रद्द करें'],
  heard: ['I heard', 'मैंने सुना'],
  typeInstead: ['Type what happened', 'लिखें क्या हुआ'],
  tap: ['Tap', 'टैप'],
  voice: ['Voice', 'आवाज़'],
  hourShort: ['h', 'बजे'],
  scheduled: ['Starts', 'शुरू'],
  pending: ['Pending', 'बाकी'],
  in_progress: ['In progress', 'चालू'],
  done: ['Done', 'पूरा'],
  startSaathi: ['Start Saathi', 'साथी शुरू करें'],
  startHint: ['Tap once to turn on Saathi’s voice', 'साथी की आवाज़ चालू करने के लिए एक बार दबाएँ'],
  offlineData: ['Offline data', 'ऑफ़लाइन डेटा'],
  fallbackNotice: ['No Hindi voice on this device — speaking English', 'इस डिवाइस पर हिंदी आवाज़ नहीं — अंग्रेज़ी में बोल रहा हूँ'],
  heat: ['Heat', 'गर्मी'],
  regular: ['Regular', 'नियमित'],
};

const TASK_TYPES = {
  'Earth Excavation': ['Earth Excavation', 'मिट्टी की खुदाई'],
  Trenching: ['Trenching', 'खाई की खुदाई'],
  'Material Loading': ['Material Loading', 'माल की लदाई'],
  Grading: ['Grading', 'ज़मीन समतल'],
  Demolition: ['Demolition', 'तोड़फोड़'],
};

const WEATHER = { Sunny: ['Sunny', 'धूप'], Rainy: ['Rain', 'बारिश'], Cloudy: ['Cloudy', 'बादल'], Windy: ['Windy', 'तेज़ हवा'] };

const FACTORS = {
  weather: ['Weather', 'मौसम'], temperature: ['Heat', 'गर्मी'], machine_age: ['Machine age', 'मशीन की उम्र'],
  operator_skill: ['Experience', 'अनुभव'], time_of_day: ['Time of day', 'दिन का समय'],
};

const LESSON_TITLES = {
  lesson_idle_engine_off: ['Engine off when waiting', 'रुकें तो इंजन बंद'],
  lesson_trench_edge: ['Trench edge distance', 'खाई के किनारे से दूरी'],
  lesson_three_points: ['Three points of contact', 'तीन जगह पकड़'],
  lesson_walkaround: ['Walk around before moving', 'चलने से पहले चक्कर'],
  lesson_smooth_cycles: ['Smooth bucket cycles', 'आराम से बाल्टी चक्र'],
  lesson_hydration: ['Water in the heat', 'गर्मी में पानी'],
};

const FINDING_TITLES = {
  excessive_idling: ['Long idle time', 'ज़्यादा देर खाली चलना'],
  fuel_without_work: ['Fuel without work', 'बिना काम ईंधन'],
  unbelted_active: ['Belt off while working', 'काम में बेल्ट खुली'],
  repeated_alerts: ['Several alerts close together', 'पास-पास कई चेतावनियाँ'],
  fatigue_drift: ['Slowing down', 'रफ़्तार धीमी'],
};

const idx = (lang) => (lang === 'hi' ? 1 : 0);
const pick = (table, key, lang) => (table[key] ? table[key][idx(lang)] : key);

export const t = (key, lang) => pick(L, key, lang);
export const taskTypeLabel = (type, lang) => pick(TASK_TYPES, type, lang);
export const weatherLabel = (w, lang) => pick(WEATHER, w, lang);
export const factorLabel = (f, lang) => pick(FACTORS, f, lang);
export const lessonTitle = (k, lang) => pick(LESSON_TITLES, k, lang);
export const findingTitle = (k, lang) => pick(FINDING_TITLES, k, lang);

export function useT() {
  const lang = useStore((s) => s.lang);
  return (key) => t(key, lang);
}
