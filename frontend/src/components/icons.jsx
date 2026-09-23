// Original line icons for task types and simple illustrations for lessons (currentColor strokes).
import { TriangleAlert, UserRound, Wrench, CircleHelp, Timer, Fuel, ShieldAlert, Activity, BellRing } from 'lucide-react';

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.5, strokeLinecap: 'round', strokeLinejoin: 'round' };

const TASK_PATHS = {
  'Earth Excavation': (
    <>
      <rect x="4" y="34" width="24" height="8" rx="4" />
      <path d="M8 34v-8h12v8" />
      <path d="M11 26v-6h8l1 6" />
      <path d="M20 22l12-10 8 8" />
      <path d="M40 20l2 8-7 2" />
      <path d="M31 44c3-6 9-8 14-6" />
    </>
  ),
  Trenching: (
    <>
      <path d="M3 22h13v16h16V22h13" />
      <path d="M16 38h16" strokeDasharray="2 4" />
      <path d="M24 6v8" />
      <path d="M19 14h10l-2 6h-6z" />
      <path d="M6 28h4M38 28h4" />
    </>
  ),
  'Material Loading': (
    <>
      <circle cx="12" cy="37" r="5" />
      <circle cx="30" cy="37" r="5" />
      <path d="M6 32V22h12l3 10" />
      <path d="M21 26h12v6" />
      <path d="M33 26l6-10h6" />
      <path d="M39 16l4 6h-6" />
      <path d="M36 44h10" />
    </>
  ),
  Grading: (
    <>
      <path d="M4 40h40" />
      <path d="M8 34h22l4-6H14z" />
      <path d="M30 34l8 0 2-8" />
      <path d="M14 28v-8h10v8" />
      <path d="M36 16h8M40 12l4 4-4 4" />
    </>
  ),
  Demolition: (
    <>
      <path d="M6 42V18h18v24" />
      <path d="M6 24h18M6 30h18M6 36h18M12 18v6M18 24v6M12 30v6M18 36v6" />
      <path d="M24 26l-4 4 3 3-4 5" />
      <path d="M30 10l12 12" />
      <circle cx="30" cy="10" r="3" />
      <path d="M42 22v10" />
      <circle cx="42" cy="35" r="4" />
    </>
  ),
};

export function TaskIcon({ type, size = 48 }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" {...stroke}>
      {TASK_PATHS[type] ?? <circle cx="24" cy="24" r="16" />}
    </svg>
  );
}

const CATEGORY_ICONS = { near_miss: TriangleAlert, person_in_zone: UserRound, machine_issue: Wrench, other: CircleHelp };

export function CategoryIcon({ category, size = 40, ...rest }) {
  const Icon = CATEGORY_ICONS[category] ?? CircleHelp;
  return <Icon size={size} strokeWidth={2.25} aria-hidden="true" {...rest} />;
}

const FINDING_ICONS = { excessive_idling: Timer, fuel_without_work: Fuel, unbelted_active: ShieldAlert, repeated_alerts: BellRing, fatigue_drift: Activity };

export function FindingIcon({ type, size = 32 }) {
  const Icon = FINDING_ICONS[type] ?? Activity;
  return <Icon size={size} strokeWidth={2.25} aria-hidden="true" />;
}

// Lesson illustrations: 120x80 scenes, one accent element each.
const ART = {
  engine: (
    <>
      <rect x="22" y="30" width="54" height="30" rx="6" />
      <path d="M32 30v-8h20v8M76 40h10v10H76" />
      <path d="M40 45h18" />
      <circle cx="96" cy="26" r="12" className="art-accent" />
      <path d="M96 20v7M91 22a8 8 0 1 0 10 0" className="art-accent-ink" />
    </>
  ),
  trench: (
    <>
      <path d="M8 38h36v28h32V38h36" />
      <path d="M44 66h32" strokeDasharray="3 6" />
      <rect x="10" y="22" width="26" height="12" rx="6" />
      <path d="M36 28h10M46 22v12" className="art-accent" />
      <path d="M40 16h12" className="art-accent" />
    </>
  ),
  ladder: (
    <>
      <path d="M40 10v62M64 10v62M40 22h24M40 38h24M40 54h24" />
      <circle cx="84" cy="20" r="6" />
      <path d="M84 26v20l-8 12M84 46l8 12M84 32l-18-8M84 32l-18 6" />
      <circle cx="66" cy="24" r="4" className="art-accent" />
      <circle cx="66" cy="38" r="4" className="art-accent" />
      <circle cx="76" cy="58" r="4" className="art-accent" />
    </>
  ),
  walkaround: (
    <>
      <rect x="40" y="30" width="40" height="22" rx="4" />
      <path d="M46 30v-8h16v8" />
      <ellipse cx="60" cy="41" rx="46" ry="30" strokeDasharray="4 7" className="art-accent" />
      <circle cx="104" cy="38" r="4" />
      <path d="M104 42v10l-3 8M104 52l3 8" />
    </>
  ),
  bucket: (
    <>
      <path d="M14 58c14-26 34-34 56-30" strokeDasharray="4 6" />
      <path d="M70 28l20 4-6 18H66z" />
      <path d="M72 34h14" />
      <path d="M8 66h104" />
      <path d="M92 20c6 2 10 6 12 12" className="art-accent" />
    </>
  ),
  water: (
    <>
      <path d="M44 22h24l-3 48H47z" />
      <path d="M46 40h20" className="art-accent" />
      <path d="M86 24c8 12 10 18 10 22a10 10 0 0 1-20 0c0-4 2-10 10-22z" className="art-accent" />
      <circle cx="24" cy="20" r="8" />
      <path d="M24 6v4M24 30v4M10 20h4M34 20h4" />
    </>
  ),
};

export function LessonArt({ art }) {
  return (
    <svg viewBox="0 0 120 80" className="lesson-art" aria-hidden="true" {...stroke} strokeWidth={2.5}>
      {ART[art]}
    </svg>
  );
}
