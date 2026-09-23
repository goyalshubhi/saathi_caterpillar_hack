// About: the synthetic-data note and the privacy statement (PLAN.md).
import { Database, ShieldCheck, Cpu, Languages } from 'lucide-react';
import { useStore } from '../state/store.js';

const TEXT = {
  en: {
    title: 'About Saathi',
    lead: 'Saathi (“companion”) is a voice companion for machine operators. It speaks; you drive.',
    items: [
      { icon: Database, head: 'Synthetic data', body: 'Demo uses synthetic data calibrated to the provided tables. Nothing shown here is a real shift.' },
      { icon: ShieldCheck, head: 'Your data stays here', body: 'Behaviour data never leaves this device. There is no manager view. Incidents and machine notes are stored for the machine, never with an operator ID, and notes expire after 48 hours.' },
      { icon: Cpu, head: 'How it thinks', body: 'Time estimates come from a model trained on past tasks and conditions. Safety alerts come from simple rules on machine signals. Saathi does not detect work cycles in real time.' },
      { icon: Languages, head: 'Languages', body: 'English and Hindi. Hindi lines are awaiting review by a native speaker.' },
    ],
  },
  hi: {
    title: 'साथी के बारे में',
    lead: 'साथी मशीन चलाने वालों का आवाज़ वाला साथी है। साथी बोलता है; आप मशीन चलाते हैं।',
    items: [
      { icon: Database, head: 'नकली (सिंथेटिक) डेटा', body: 'डेमो में दी गई तालिकाओं के हिसाब से बनाया गया सिंथेटिक डेटा है। यहाँ दिखाई गई कोई भी शिफ्ट असली नहीं है।' },
      { icon: ShieldCheck, head: 'आपका डेटा यहीं रहता है', body: 'आपके काम का डेटा इस डिवाइस से बाहर नहीं जाता। कोई मैनेजर व्यू नहीं है। घटनाएँ और मशीन के संदेश मशीन के नाम पर रखे जाते हैं, ऑपरेटर ID के साथ नहीं, और संदेश 48 घंटे बाद हट जाते हैं।' },
      { icon: Cpu, head: 'यह कैसे सोचता है', body: 'समय का अनुमान पिछले कामों और हालात पर सीखे मॉडल से आता है। सुरक्षा चेतावनियाँ मशीन के संकेतों पर सरल नियमों से आती हैं। साथी काम के चक्र असली समय में नहीं पहचानता।' },
      { icon: Languages, head: 'भाषाएँ', body: 'अंग्रेज़ी और हिंदी। हिंदी पंक्तियों की समीक्षा अभी बाकी है।' },
    ],
  },
};

export default function About() {
  const lang = useStore((s) => s.lang);
  const c = TEXT[lang] ?? TEXT.en;
  return (
    <div className="screen about" data-testid="screen-about">
      <h1 className="display">{c.title}</h1>
      <p className="lead">{c.lead}</p>
      <div className="hazard" role="presentation" />
      <div className="about__grid">
        {c.items.map(({ icon: Icon, head, body }) => (
          <article key={head} className="panel about__item">
            <Icon size={34} aria-hidden="true" />
            <h2>{head}</h2>
            <p>{body}</p>
          </article>
        ))}
      </div>
      <p className="about__badge"><span className="badge badge--sim">Simulated data</span></p>
    </div>
  );
}
