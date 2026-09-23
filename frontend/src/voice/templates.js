// Every line Saathi speaks, in English (en) and Hindi (hi), with {slot} placeholders.
//
// NOTE FOR REVIEW: the Hindi text was written by a non-native author and MUST be reviewed
// by a native Hindi speaker before any real use (tone should be warm, simple, spoken Hindi).
//
// Phrasings: safety lines (SAFETY_KEYS) have exactly ONE fixed phrasing: a plain string per language.
// Every other key has 3 phrasings: arrays where en[i] and hi[i] say the same thing and use the same
// slots. The voice queue picks the index (seeded in demo mode, random otherwise; see phrasing.js).
//
// Slot values that appear in VOCAB (task types, weather, incident categories, factors)
// are translated automatically. Array slot values are translated item by item and joined.

// Safety lines never vary: the operator must hear exactly the same words every time.
export const SAFETY_KEYS = [
  'belt_before_move',
  'seatbelt_unfastened',
  'proximity_alert',
  'safety_alert',
  'warn.rain_slippery',
  'warn.rain_trench_edge',
  'warn.wind_caution',
  'warn.heat_hydration',
  'memory_incident',
];

export const TEMPLATES = {
  // Morning briefing
  greeting: {
    en: [
      'Good morning! I am Saathi. We have {count} tasks today.',
      'Good morning! Saathi here. {count} tasks lined up for today.',
      'Morning! I am Saathi, your companion. Today we have {count} tasks.',
    ],
    hi: [
      'सुप्रभात! मैं साथी हूँ। आज हमारे पास {count} काम हैं।',
      'सुप्रभात! साथी बोल रहा हूँ। आज {count} काम तय हैं।',
      'नमस्कार! मैं आपका साथी हूँ। आज हमें {count} काम करने हैं।',
    ],
  },
  shift_hello: {
    en: [
      'Hello! I am Saathi, with you on machine {machine_id}.',
      'Welcome to machine {machine_id}. I am Saathi, I will be with you this shift.',
      'Hi, Saathi here on machine {machine_id}. Let us have a safe shift.',
    ],
    hi: [
      'नमस्ते! मैं साथी हूँ, मशीन {machine_id} पर आपके साथ।',
      'मशीन {machine_id} पर आपका स्वागत है। मैं साथी हूँ, इस शिफ्ट में आपके साथ रहूँगा।',
      'नमस्ते, मैं साथी, मशीन {machine_id} पर। चलिए, शिफ्ट सुरक्षित रखें।',
    ],
  },
  task_card: {
    en: [
      'Task {n}: {task_type}, about {predicted_min} minutes.',
      'Number {n} is {task_type}. It should take about {predicted_min} minutes.',
      'Task {n} is {task_type}; plan for about {predicted_min} minutes.',
    ],
    hi: [
      'काम {n}: {task_type}, लगभग {predicted_min} मिनट।',
      'नंबर {n}: {task_type}। इसमें लगभग {predicted_min} मिनट लगेंगे।',
      'काम {n} है {task_type}; लगभग {predicted_min} मिनट मानकर चलिए।',
    ],
  },
  heat_today: {
    en: [
      'It will get hot today, up to {max_temp} degrees.',
      'A hot day ahead, up to {max_temp} degrees in the afternoon.',
      'The temperature will climb to {max_temp} degrees today.',
    ],
    hi: [
      'आज गर्मी ज़्यादा होगी, {max_temp} डिग्री तक।',
      'आज दिन गर्म रहेगा, दोपहर में {max_temp} डिग्री तक।',
      'आज तापमान {max_temp} डिग्री तक पहुँचेगा।',
    ],
  },
  rain_today: {
    en: [
      'There is light rain this morning.',
      'Light rain this morning, so the ground may be soft.',
      'Expect some light rain early today.',
    ],
    hi: [
      'आज सुबह हल्की बारिश है।',
      'सुबह हल्की बारिश है, ज़मीन नरम हो सकती है।',
      'आज सुबह थोड़ी बारिश होने की उम्मीद है।',
    ],
  },
  plan_order: {
    en: [
      'Suggested order: {order}.',
      'I suggest this order: {order}.',
      'Best order for today: {order}.',
    ],
    hi: [
      'सुझाया गया क्रम: {order}।',
      'मेरा सुझाव है यह क्रम: {order}।',
      'आज के लिए सबसे अच्छा क्रम: {order}।',
    ],
  },
  breaks_planned: {
    en: [
      'Breaks at {hours} o\'clock.',
      'I have planned breaks at {hours} o\'clock.',
      'Rest breaks at {hours} o\'clock. Please take them.',
    ],
    hi: [
      'आराम का समय: {hours} बजे।',
      'मैंने {hours} बजे आराम रखा है।',
      'आराम {hours} बजे है। ज़रूर लीजिए।',
    ],
  },
  memory_incident: {
    en: 'Note from the last shift on this machine: {category} was reported. Stay alert.',
    hi: 'पिछली शिफ्ट का संदेश: इस मशीन पर {category} दर्ज हुआ था। सावधान रहें।',
  },

  // Pre-task
  pretask_estimate: {
    en: [
      '{task_type}, {weather}. CAT estimate {cat_min} minutes, I expect about {predicted_min} minutes.',
      'Now {task_type}, weather: {weather}. The CAT estimate is {cat_min} minutes; mine is about {predicted_min}.',
      'Next up: {task_type}, {weather}. Plan for about {predicted_min} minutes instead of the CAT {cat_min}.',
    ],
    hi: [
      '{task_type}, {weather}। CAT का अनुमान {cat_min} मिनट, मेरा अनुमान लगभग {predicted_min} मिनट।',
      'अब {task_type}, मौसम: {weather}। CAT का अनुमान {cat_min} मिनट है; मेरा अनुमान लगभग {predicted_min} मिनट।',
      'अगला काम: {task_type}, {weather}। CAT के {cat_min} मिनट की जगह लगभग {predicted_min} मिनट मानकर चलिए।',
    ],
  },
  // Condition warnings (keys emitted by backend/planner) — safety: one fixed phrasing
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

  // In-task safety — one fixed phrasing each
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
    en: [
      'Logged: {category}. Thank you, the next shift will know.',
      'Noted: {category}. I will tell the next shift.',
      'Thanks for reporting {category}. It is saved for this machine.',
    ],
    hi: [
      'दर्ज कर लिया: {category}। धन्यवाद, अगली शिफ्ट को पता रहेगा।',
      'नोट कर लिया: {category}। अगली शिफ्ट को बता दूँगा।',
      '{category} बताने के लिए धन्यवाद। यह इस मशीन के लिए सहेज लिया गया है।',
    ],
  },

  // Care
  break_time: {
    en: [
      'Time for a break. Drink some water.',
      'Break time. Step down, stretch and have some water.',
      'Let us pause here. Water first, then rest a little.',
    ],
    hi: [
      'आराम का समय। थोड़ा पानी पी लीजिए।',
      'आराम का समय। नीचे उतरिए, थोड़ा शरीर खोलिए और पानी पीजिए।',
      'यहाँ थोड़ा रुकते हैं। पहले पानी, फिर थोड़ा आराम।',
    ],
  },
  care_break: {
    en: [
      'You have been working hard. Let us take a ten minute break.',
      'You have been at it for a while. A ten minute rest will help you stay sharp.',
      'Time to recharge. Please take ten minutes, the work will wait.',
    ],
    hi: [
      'आप बहुत मेहनत कर रहे हैं। चलिए दस मिनट का आराम करते हैं।',
      'आप काफ़ी देर से लगे हैं। दस मिनट का आराम आपको चुस्त रखेगा।',
      'थोड़ा सुस्ता लीजिए। दस मिनट का आराम कीजिए, काम इंतज़ार कर लेगा।',
    ],
  },

  // Idle-time lessons (coaching)
  lesson_idle_engine_off: {
    en: [
      'Quick tip while we wait: if you will idle for more than five minutes, switch the engine off. It saves fuel.',
      'While we wait: an engine idling for five minutes or more is just burning fuel. Switch it off.',
      'A tip for this pause: for long stops, turn the engine off. It saves fuel and wear.',
    ],
    hi: [
      'रुकते हुए एक छोटी सलाह: अगर पाँच मिनट से ज़्यादा रुकना हो, तो इंजन बंद कर दें। ईंधन बचता है।',
      'इंतज़ार के बीच: पाँच मिनट या ज़्यादा खाली चलता इंजन सिर्फ़ ईंधन जलाता है। इसे बंद कर दीजिए।',
      'इस रुकावट में एक सलाह: लंबे समय रुकना हो तो इंजन बंद कर दें। ईंधन और घिसाई दोनों बचते हैं।',
    ],
  },
  lesson_trench_edge: {
    en: [
      'Quick tip: keep the tracks at least one metre back from a trench edge, more when the ground is wet.',
      'Tip: trench edges can give way. Keep the tracks a metre or more back, further when wet.',
      'Remember: wet soil near a trench is weak. Stay at least one metre from the edge.',
    ],
    hi: [
      'छोटी सलाह: खाई के किनारे से पटरियों को कम से कम एक मीटर पीछे रखें, गीली ज़मीन पर और ज़्यादा।',
      'सलाह: खाई का किनारा धँस सकता है। पटरियों को एक मीटर या ज़्यादा पीछे रखें, गीली ज़मीन पर और दूर।',
      'याद रखें: खाई के पास गीली मिट्टी कमज़ोर होती है। किनारे से कम से कम एक मीटर दूर रहें।',
    ],
  },
  lesson_three_points: {
    en: [
      'Quick tip: keep three points of contact when climbing in or out of the cab.',
      'Tip: two hands and a foot, or two feet and a hand, whenever you climb in or out.',
      'Remember: face the machine and keep three points of contact on the steps.',
    ],
    hi: [
      'छोटी सलाह: केबिन में चढ़ते और उतरते समय तीन जगह पकड़ बनाए रखें।',
      'सलाह: चढ़ते-उतरते समय हमेशा दो हाथ और एक पैर, या दो पैर और एक हाथ टिकाए रखें।',
      'याद रखें: सीढ़ी पर मशीन की ओर मुँह करके तीन जगह पकड़ बनाए रखें।',
    ],
  },
  lesson_walkaround: {
    en: [
      'Quick tip: walk once around the machine before moving. You will see what the seat cannot show you.',
      'Tip: a quick walk around the machine before moving shows you people and obstacles you cannot see from the seat.',
      'Remember: check all sides of the machine before you start moving.',
    ],
    hi: [
      'छोटी सलाह: चलने से पहले मशीन का एक चक्कर लगाएँ। जो सीट से नहीं दिखता, वह दिख जाएगा।',
      'सलाह: चलने से पहले मशीन का एक चक्कर लगाएँ, सीट से न दिखने वाले लोग और रुकावटें दिख जाएँगी।',
      'याद रखें: चलना शुरू करने से पहले मशीन के चारों तरफ़ देख लें।',
    ],
  },
  lesson_smooth_cycles: {
    en: [
      'Quick tip: smooth, full bucket cycles use less fuel than many short, jerky ones.',
      'Tip: smooth, steady movements fill the bucket better and burn less fuel.',
      'Remember: jerky controls waste fuel. Full, smooth cycles do more with less.',
    ],
    hi: [
      'छोटी सलाह: आराम से भरे हुए बाल्टी चक्र, कई छोटे झटकेदार चक्रों से कम ईंधन खाते हैं।',
      'सलाह: आराम और एक लय में चलाने से बाल्टी अच्छी भरती है और ईंधन कम लगता है।',
      'याद रखें: झटके से चलाने में ईंधन बर्बाद होता है। पूरे और आराम से चक्र कम में ज़्यादा काम करते हैं।',
    ],
  },
  lesson_hydration: {
    en: [
      'Quick tip: in the heat, drink a glass of water every hour, even if you are not thirsty.',
      'Tip: in this heat, sip water every hour, even before you feel thirsty.',
      'Remember: heat tires you before you notice. A glass of water every hour keeps you sharp.',
    ],
    hi: [
      'छोटी सलाह: गर्मी में हर घंटे एक गिलास पानी पिएँ, प्यास न लगे तब भी।',
      'सलाह: इस गर्मी में प्यास लगने से पहले ही हर घंटे पानी पीते रहें।',
      'याद रखें: गर्मी पता चलने से पहले थका देती है। हर घंटे एक गिलास पानी आपको चुस्त रखेगा।',
    ],
  },

  // Debrief
  debrief_over: {
    en: [
      '{over_min} minutes over. About {uncontrollable_min} from {factors}, about {controllable_min} from idle gaps.',
      'This task ran {over_min} minutes long: about {uncontrollable_min} because of {factors}, and about {controllable_min} from idle gaps.',
      'We went {over_min} minutes over the CAT estimate. Around {uncontrollable_min} of that was {factors}, around {controllable_min} was idle time.',
    ],
    hi: [
      '{over_min} मिनट ज़्यादा लगे। लगभग {uncontrollable_min} मिनट {factors} की वजह से, और लगभग {controllable_min} मिनट रुकावटों से।',
      'यह काम {over_min} मिनट ज़्यादा चला: लगभग {uncontrollable_min} मिनट {factors} के कारण, और लगभग {controllable_min} मिनट रुकावटों से।',
      'हम CAT के अनुमान से {over_min} मिनट ऊपर गए। इसमें करीब {uncontrollable_min} मिनट {factors} की वजह से थे, और करीब {controllable_min} मिनट खाली समय के।',
    ],
  },
  debrief_on_time: {
    en: [
      'Finished on time. Well done.',
      'Right on time. Good work.',
      'Done within the estimate. Nicely done.',
    ],
    hi: [
      'काम समय पर पूरा हुआ। बहुत बढ़िया।',
      'बिलकुल समय पर। अच्छा काम।',
      'अनुमान के अंदर पूरा हुआ। बढ़िया।',
    ],
  },
  debrief_not_your_fault: {
    en: [
      'Most of this was not in your hands.',
      'Most of the delay was outside your control.',
      'Do not worry, most of this came from conditions, not from you.',
    ],
    hi: [
      'इसमें ज़्यादातर आपके हाथ में नहीं था।',
      'ज़्यादातर देरी आपके बस में नहीं थी।',
      'चिंता मत कीजिए, इसमें ज़्यादातर हालात की वजह से था, आपकी वजह से नहीं।',
    ],
  },
  // Behaviour findings (keys emitted by backend/ml)
  'finding.excessive_idling': {
    en: [
      'The machine idled for {minutes} minutes.',
      'The engine ran idle for {minutes} minutes.',
      'There were {minutes} minutes of idling.',
    ],
    hi: [
      'मशीन {minutes} मिनट तक खाली चलती रही।',
      'इंजन {minutes} मिनट खाली चलता रहा।',
      '{minutes} मिनट तक मशीन बेकार चलती रही।',
    ],
  },
  'finding.fuel_without_work': {
    en: [
      '{fuel_l} litres of fuel were burned with little or no work done.',
      'About {fuel_l} litres of fuel went into idling rather than work.',
      'Around {fuel_l} litres of fuel were used with almost nothing to show for it.',
    ],
    hi: [
      'बहुत कम या बिना काम के {fuel_l} लीटर ईंधन खर्च हुआ।',
      'लगभग {fuel_l} लीटर ईंधन काम की जगह खाली चलने में गया।',
      'लगभग बिना काम के करीब {fuel_l} लीटर ईंधन लग गया।',
    ],
  },
  'finding.unbelted_active': {
    en: [
      'The seatbelt was off while working for {minutes} minutes.',
      'The machine was working for {minutes} minutes without the seatbelt on.',
      'For {minutes} minutes the belt was off during work. Please keep it on.',
    ],
    hi: [
      'काम करते समय {minutes} मिनट तक सीट बेल्ट खुली रही।',
      'मशीन {minutes} मिनट बिना सीट बेल्ट के चली।',
      '{minutes} मिनट काम के दौरान बेल्ट खुली थी। कृपया इसे बाँधे रखें।',
    ],
  },
  'finding.repeated_alerts': {
    en: [
      '{count} safety alerts within {minutes} minutes.',
      'There were {count} safety alerts in {minutes} minutes.',
      '{count} alerts came within {minutes} minutes. Let us slow down a little.',
    ],
    hi: [
      '{minutes} मिनट में {count} सुरक्षा चेतावनियाँ आईं।',
      '{minutes} मिनट के अंदर {count} सुरक्षा चेतावनियाँ हुईं।',
      '{minutes} मिनट में {count} चेतावनियाँ आईं। थोड़ा धीरे चलते हैं।',
    ],
  },
  'finding.fatigue_drift': {
    en: [
      'Your rhythm is slowing down. A short break will help.',
      'You seem to be slowing down. A short rest would help.',
      'Your pace has dropped over the last hour. Time for a quick break.',
    ],
    hi: [
      'आपकी रफ़्तार धीमी हो रही है। थोड़ा आराम मदद करेगा।',
      'लगता है आप थक रहे हैं। थोड़ा आराम अच्छा रहेगा।',
      'पिछले घंटे में आपकी रफ़्तार कम हुई है। थोड़े आराम का समय है।',
    ],
  },

  // Command acknowledgements
  cmd_log_incident: {
    en: [
      'What happened? Tap a button or tell me.',
      'Tell me what happened, or tap one of the buttons.',
      'Okay, reporting an incident. What was it?',
    ],
    hi: [
      'क्या हुआ? बटन दबाइए या मुझे बताइए।',
      'बताइए क्या हुआ, या कोई बटन दबाइए।',
      'ठीक है, घटना दर्ज करते हैं। क्या हुआ था?',
    ],
  },
  cmd_break: {
    en: [
      'Okay, take your break. I will be here.',
      'Enjoy your break. I will keep watch.',
      'Sure, rest well. Call me when you are back.',
    ],
    hi: [
      'ठीक है, आराम कीजिए। मैं यहीं हूँ।',
      'आराम कीजिए। मैं ध्यान रखूँगा।',
      'ज़रूर, अच्छे से आराम कीजिए। लौटकर मुझे बुलाइए।',
    ],
  },
  cmd_quiet_on: {
    en: [
      'Quiet mode on. I will speak only for safety.',
      'Going quiet. Only safety alerts from now on.',
      'Quiet mode is on. You will still hear safety warnings.',
    ],
    hi: [
      'शांत मोड चालू। अब मैं सिर्फ़ सुरक्षा के लिए बोलूँगा।',
      'अब मैं चुप रहूँगा। सिर्फ़ सुरक्षा चेतावनियाँ दूँगा।',
      'शांत मोड चालू है। सुरक्षा चेतावनियाँ फिर भी सुनाई देंगी।',
    ],
  },
  cmd_quiet_off: {
    en: [
      'Quiet mode off.',
      'I am back. Quiet mode is off.',
      'Quiet mode off. I will speak normally again.',
    ],
    hi: [
      'शांत मोड बंद।',
      'मैं वापस हूँ। शांत मोड बंद।',
      'शांत मोड बंद। अब मैं फिर से सामान्य रूप से बोलूँगा।',
    ],
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

export function isSafetyKey(key) {
  return SAFETY_KEYS.includes(key);
}

// Number of phrasings for a key (1 for safety lines).
export function variantCount(key) {
  const en = TEMPLATES[key]?.en;
  return Array.isArray(en) ? en.length : 1;
}

// The raw (unfilled) text of one phrasing. Out-of-range variants wrap around.
export function phrasing(key, lang = 'en', variant = 0) {
  if (!hasTemplate(key)) throw new Error(`Unknown message key: ${key}`);
  const t = TEMPLATES[key][lang] ?? TEMPLATES[key].en;
  if (!Array.isArray(t)) return t;
  return t[(((variant ?? 0) % t.length) + t.length) % t.length];
}

export function slotNames(text) {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

// Render a line. Unknown keys throw (contract mismatch); missing slots stay visible as {name}.
export function render(key, slots = {}, lang = 'en', variant = 0) {
  return phrasing(key, lang, variant).replace(/\{(\w+)\}/g, (whole, name) =>
    slots[name] === undefined || slots[name] === null ? whole : translate(slots[name], lang));
}
