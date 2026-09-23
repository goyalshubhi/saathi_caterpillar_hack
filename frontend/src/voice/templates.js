// Every line Saathi speaks, in English (en) and Hindi (hi), with {slot} placeholders.
//
// NOTE FOR REVIEW: the Hindi text was written by a non-native author and MUST be reviewed
// by a native Hindi speaker before any real use (tone should be warm, simple, spoken Hindi).
//
// Slot values that appear in VOCAB (task types, weather, incident categories, factors)
// are translated automatically. Array slot values are translated item by item and joined.

export const TEMPLATES = {
  // Morning briefing
  greeting: {
    en: 'Good morning! I am Saathi. We have {count} tasks today.',
    hi: 'सुप्रभात! मैं साथी हूँ। आज हमारे पास {count} काम हैं।',
  },
  shift_hello: {
    en: 'Hello! I am Saathi, with you on machine {machine_id}.',
    hi: 'नमस्ते! मैं साथी हूँ, मशीन {machine_id} पर आपके साथ।',
  },
  task_card: {
    en: 'Task {n}: {task_type}, about {predicted_min} minutes.',
    hi: 'काम {n}: {task_type}, लगभग {predicted_min} मिनट।',
  },
  heat_today: {
    en: 'It will get hot today, up to {max_temp} degrees.',
    hi: 'आज गर्मी ज़्यादा होगी, {max_temp} डिग्री तक।',
  },
  rain_today: {
    en: 'There is light rain this morning.',
    hi: 'आज सुबह हल्की बारिश है।',
  },
  plan_order: {
    en: 'Suggested order: {order}.',
    hi: 'सुझाया गया क्रम: {order}।',
  },
  breaks_planned: {
    en: 'Breaks at {hours} o\'clock.',
    hi: 'आराम का समय: {hours} बजे।',
  },
  memory_incident: {
    en: 'Note from the last shift on this machine: {category} was reported. Stay alert.',
    hi: 'पिछली शिफ्ट का संदेश: इस मशीन पर {category} दर्ज हुआ था। सावधान रहें।',
  },

  // Pre-task
  pretask_estimate: {
    en: '{task_type}, {weather}. CAT estimate {cat_min} minutes, I expect about {predicted_min} minutes.',
    hi: '{task_type}, {weather}। CAT का अनुमान {cat_min} मिनट, मेरा अनुमान लगभग {predicted_min} मिनट।',
  },
  // Condition warnings (keys emitted by backend/planner)
  'warn.rain_slippery': {
    en: 'The ground is slippery after rain. Move slowly and carefully during {task_type}.',
    hi: 'बारिश से ज़मीन फिसलन भरी है। {task_type} के समय धीरे और सावधानी से चलें।',
  },
  'warn.rain_trench_edge': {
    en: 'Keep the machine at least {distance_m} metres back from the trench edge.',
    hi: 'मशीन को खाई के किनारे से कम से कम {distance_m} मीटर पीछे रखें।',
  },
  'warn.wind_caution': {
    en: 'Strong wind today. Take extra care with {task_type} and any lifting.',
    hi: 'आज तेज़ हवा है। {task_type} और किसी भी उठाने के काम में ख़ास सावधानी रखें।',
  },
  'warn.heat_hydration': {
    en: 'It will be {temperature_c} degrees. Drink water and take your breaks.',
    hi: '{temperature_c} डिग्री तक गर्मी होगी। पानी पीते रहें और आराम ज़रूर करें।',
  },

  // In-task safety
  belt_before_move: {
    en: 'Belt before you move! Fasten your seatbelt.',
    hi: 'चलने से पहले बेल्ट! सीट बेल्ट बाँध लीजिए।',
  },
  seatbelt_unfastened: {
    en: 'Your seatbelt is off. Please fasten it.',
    hi: 'आपकी सीट बेल्ट खुली है। कृपया बाँध लीजिए।',
  },
  proximity_alert: {
    en: 'Stop! Someone is {distance_m} metres from the machine.',
    hi: 'रुकिए! मशीन से {distance_m} मीटर पर कोई है।',
  },
  safety_alert: {
    en: 'Safety alert. Check all around the machine.',
    hi: 'सुरक्षा चेतावनी। मशीन के चारों ओर देख लीजिए।',
  },
  incident_logged: {
    en: 'Logged: {category}. Thank you, the next shift will know.',
    hi: 'दर्ज कर लिया: {category}। धन्यवाद, अगली शिफ्ट को पता रहेगा।',
  },

  // Care
  break_time: {
    en: 'Time for a break. Drink some water.',
    hi: 'आराम का समय। थोड़ा पानी पी लीजिए।',
  },
  care_break: {
    en: 'You have been working hard. Let us take a ten minute break.',
    hi: 'आप बहुत मेहनत कर रहे हैं। चलिए दस मिनट का आराम करते हैं।',
  },

  // Idle-time lessons (coaching)
  lesson_idle_engine_off: {
    en: 'Quick tip while we wait: if you will idle for more than five minutes, switch the engine off. It saves fuel.',
    hi: 'रुकते हुए एक छोटी सलाह: अगर पाँच मिनट से ज़्यादा रुकना हो, तो इंजन बंद कर दें। ईंधन बचता है।',
  },
  lesson_trench_edge: {
    en: 'Quick tip: keep the tracks at least one metre back from a trench edge, more when the ground is wet.',
    hi: 'छोटी सलाह: खाई के किनारे से पटरियों को कम से कम एक मीटर पीछे रखें, गीली ज़मीन पर और ज़्यादा।',
  },
  lesson_three_points: {
    en: 'Quick tip: keep three points of contact when climbing in or out of the cab.',
    hi: 'छोटी सलाह: केबिन में चढ़ते और उतरते समय तीन जगह पकड़ बनाए रखें।',
  },
  lesson_walkaround: {
    en: 'Quick tip: walk once around the machine before moving. You will see what the seat cannot show you.',
    hi: 'छोटी सलाह: चलने से पहले मशीन का एक चक्कर लगाएँ। जो सीट से नहीं दिखता, वह दिख जाएगा।',
  },
  lesson_smooth_cycles: {
    en: 'Quick tip: smooth, full bucket cycles use less fuel than many short, jerky ones.',
    hi: 'छोटी सलाह: आराम से भरे हुए बाल्टी चक्र, कई छोटे झटकेदार चक्रों से कम ईंधन खाते हैं।',
  },
  lesson_hydration: {
    en: 'Quick tip: in the heat, drink a glass of water every hour, even if you are not thirsty.',
    hi: 'छोटी सलाह: गर्मी में हर घंटे एक गिलास पानी पिएँ, प्यास न लगे तब भी।',
  },

  // Debrief
  debrief_over: {
    en: '{over_min} minutes over. About {uncontrollable_min} from {factors}, about {controllable_min} from idle gaps.',
    hi: '{over_min} मिनट ज़्यादा लगे। लगभग {uncontrollable_min} मिनट {factors} की वजह से, और लगभग {controllable_min} मिनट रुकावटों से।',
  },
  // First tracked shift (no personal history): anchored to the CAT estimate, no personal comparison.
  debrief_over_first_shift: {
    en: '{over_min} minutes over the CAT estimate. About {uncontrollable_min} from {factors}, about {controllable_min} from idle gaps.',
    hi: 'CAT के अनुमान से {over_min} मिनट ज़्यादा लगे। लगभग {uncontrollable_min} मिनट {factors} की वजह से, और लगभग {controllable_min} मिनट रुकावटों से।',
  },
  debrief_near_time: {
    en: '{over_min} minutes over. Close to plan.',
    hi: '{over_min} मिनट ज़्यादा लगे। लगभग योजना के अनुसार।',
  },
  debrief_on_time: {
    en: 'Finished on time. Well done.',
    hi: 'काम समय पर पूरा हुआ। बहुत बढ़िया।',
  },
  debrief_not_your_fault: {
    en: 'Most of this was not in your hands.',
    hi: 'इसमें ज़्यादातर आपके हाथ में नहीं था।',
  },
  // Behaviour findings (keys emitted by backend/ml)
  'finding.excessive_idling': {
    en: 'The machine idled for {minutes} minutes.',
    hi: 'मशीन {minutes} मिनट तक खाली चलती रही।',
  },
  'finding.fuel_without_work': {
    en: '{fuel_l} litres of fuel were burned with little or no work done.',
    hi: 'बहुत कम या बिना काम के {fuel_l} लीटर ईंधन खर्च हुआ।',
  },
  'finding.unbelted_active': {
    en: 'The seatbelt was off while working for {minutes} minutes.',
    hi: 'काम करते समय {minutes} मिनट तक सीट बेल्ट खुली रही।',
  },
  'finding.repeated_alerts': {
    en: '{count} safety alerts within {minutes} minutes.',
    hi: '{minutes} मिनट में {count} सुरक्षा चेतावनियाँ आईं।',
  },
  'finding.fatigue_drift': {
    en: 'Your rhythm is slowing down. A short break will help.',
    hi: 'आपकी रफ़्तार धीमी हो रही है। थोड़ा आराम मदद करेगा।',
  },
  'finding.fatigue_drift_first_shift': {
    en: 'The pace has slowed compared with earlier in this shift. A short break will help.',
    hi: 'इस शिफ्ट में पहले के मुकाबले काम की रफ़्तार कम हुई है। थोड़ा आराम मदद करेगा।',
  },

  // Command acknowledgements
  cmd_log_incident: {
    en: 'What happened? Tap a button or tell me.',
    hi: 'क्या हुआ? बटन दबाइए या मुझे बताइए।',
  },
  cmd_break: {
    en: 'Okay, take your break. I will be here.',
    hi: 'ठीक है, आराम कीजिए। मैं यहीं हूँ।',
  },
  cmd_quiet_on: {
    en: 'Quiet mode on. I will speak only for safety.',
    hi: 'शांत मोड चालू। अब मैं सिर्फ़ सुरक्षा के लिए बोलूँगा।',
  },
  cmd_quiet_off: {
    en: 'Quiet mode off.',
    hi: 'शांत मोड बंद।',
  },
};

// Translatable slot values.
export const VOCAB = {
  // task types
  'Earth Excavation': { en: 'earth excavation', hi: 'मिट्टी की खुदाई' },
  Trenching: { en: 'trenching', hi: 'खाई की खुदाई' },
  'Material Loading': { en: 'material loading', hi: 'माल की लदाई' },
  Grading: { en: 'grading', hi: 'ज़मीन समतल करना' },
  Demolition: { en: 'demolition', hi: 'तोड़फोड़' },
  // weather
  Sunny: { en: 'sunny', hi: 'धूप' },
  Rainy: { en: 'light rain', hi: 'हल्की बारिश' },
  Cloudy: { en: 'cloudy', hi: 'बादल' },
  Windy: { en: 'windy', hi: 'तेज़ हवा' },
  // incident categories
  near_miss: { en: 'a near miss', hi: 'बाल-बाल बचाव' },
  person_in_zone: { en: 'a person in the work zone', hi: 'काम के क्षेत्र में व्यक्ति' },
  machine_issue: { en: 'a machine problem', hi: 'मशीन में ख़राबी' },
  other: { en: 'an issue', hi: 'एक समस्या' },
  // prediction factors
  weather: { en: 'rain', hi: 'बारिश' },
  temperature: { en: 'heat', hi: 'गर्मी' },
  machine_age: { en: 'machine age', hi: 'मशीन की उम्र' },
  operator_skill: { en: 'experience level', hi: 'अनुभव' },
  time_of_day: { en: 'time of day', hi: 'दिन के समय' },
};

export const AND = { en: 'and', hi: 'और' };

export const LANGS = ['en', 'hi'];

function translate(value, lang) {
  if (Array.isArray(value)) {
    const parts = value.map((v) => translate(v, lang));
    if (parts.length <= 1) return parts.join('');
    return `${parts.slice(0, -1).join(', ')} ${AND[lang]} ${parts[parts.length - 1]}`;
  }
  if (typeof value === 'string' && VOCAB[value]) return VOCAB[value][lang];
  return String(value);
}

export function hasTemplate(key) {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, key);
}

export function slotNames(text) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

// Render a line. Unknown keys throw (contract mismatch); missing slots stay visible as {name}.
export function render(key, slots = {}, lang = 'en') {
  if (!hasTemplate(key)) throw new Error(`Unknown message key: ${key}`);
  const text = TEMPLATES[key][lang] ?? TEMPLATES[key].en;
  return text.replace(/\{(\w+)\}/g, (whole, name) =>
    slots[name] === undefined || slots[name] === null ? whole : translate(slots[name], lang));
}
