// Saathi: an original SVG character — a friendly senior operator in a hard hat.
// States: idle (slow breathing), speaking (mouth + pulse ring), alert (red glow, upright), rest (eyes
// closed, holding a water bottle). All loops stop when the user prefers reduced motion.
import { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { useStore } from '../state/store.js';

export const AVATAR_STATES = ['idle', 'speaking', 'alert', 'rest'];

const SKIN = '#b77b52';
const SKIN_SHADE = '#9c6641';
const HAIR = '#d4d4cf';
const SHIRT = '#3a4650';
const VEST = '#56626c';
const REFLECT = '#dfe5ea';
const HAT = '#ffcd11';
const HAT_SHADE = '#d6a800';

const RING = { idle: null, speaking: 'var(--accent)', alert: 'var(--danger)', rest: 'var(--care)' };

export default function Avatar({ state = 'idle', size = 160, title = 'Saathi', testId = 'avatar' }) {
  const reduce = useReducedMotion();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const id = (name) => `av-${name}-${uid}`;
  const loop = (duration, extra = {}) => (reduce ? { duration: 0 } : { duration, repeat: Infinity, ease: 'easeInOut', ...extra });
  const ring = RING[state];
  const alert = state === 'alert';
  const rest = state === 'rest';

  return (
    <div className={`avatar avatar--${state}`} style={{ width: size, height: size * 1.1 }} data-testid={testId} data-state={state} role="img" aria-label={`${title} (${state})`}>
      <svg viewBox="0 0 200 220" width="100%" height="100%" aria-hidden="true">
        <defs>
          <radialGradient id={id('glow')} cx="50%" cy="55%" r="50%">
            <stop offset="0%" stopColor="var(--danger)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--danger)" stopOpacity="0" />
          </radialGradient>
          <linearGradient id={id('hat')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffe066" />
            <stop offset="100%" stopColor={HAT} />
          </linearGradient>
          <clipPath id={id('frame')}><circle cx="100" cy="112" r="96" /></clipPath>
        </defs>

        {/* backdrop disc */}
        <circle cx="100" cy="112" r="96" fill="var(--avatar-disc)" />
        {alert && (
          <motion.circle cx="100" cy="112" r="100" fill={`url(#${id('glow')})`}
            animate={{ opacity: [0.6, 1, 0.6] }} transition={loop(0.9)} />
        )}
        {ring && (
          <motion.circle cx="100" cy="112" r="94" fill="none" stroke={ring} strokeWidth="4"
            initial={{ opacity: 0.8, scale: 1 }} style={{ transformOrigin: '100px 112px' }}
            animate={reduce ? { opacity: 0.7 } : { opacity: [0.8, 0], scale: [1, 1.08] }}
            transition={loop(state === 'rest' ? 3.2 : 1.2, { ease: 'easeOut' })} />
        )}

        <g clipPath={`url(#${id('frame')})`}>
          {/* body: breathes */}
          <motion.g style={{ transformOrigin: '100px 220px' }}
            animate={alert ? { y: -5, scale: 1.03 } : reduce ? {} : { scaleY: [1, 1.018, 1] }}
            transition={alert ? { duration: 0.2 } : loop(rest ? 5 : 4)}>
            {/* shoulders + shirt */}
            <path d="M22 220 C 26 172, 58 156, 100 156 C 142 156, 174 172, 178 220 Z" fill={SHIRT} />
            {/* vest panels with reflective stripes */}
            <path d="M40 220 C 44 186, 60 168, 82 162 L 90 220 Z" fill={VEST} />
            <path d="M160 220 C 156 186, 140 168, 118 162 L 110 220 Z" fill={VEST} />
            <path d="M48 198 L 88 196 L 89 205 L 45 208 Z" fill={REFLECT} opacity="0.9" />
            <path d="M152 198 L 112 196 L 111 205 L 155 208 Z" fill={REFLECT} opacity="0.9" />
            {/* collar + neck */}
            <path d="M84 150 L 116 150 L 114 166 C 108 172, 92 172, 86 166 Z" fill={SKIN_SHADE} />
            <path d="M80 160 L 100 176 L 120 160 L 124 166 L 100 186 L 76 166 Z" fill="#2c353d" />

            {/* water bottle + hand (rest) */}
            {rest && (
              <motion.g initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.25 }}>
                <rect x="132" y="138" width="22" height="46" rx="7" fill="#8fd9e8" opacity="0.9" />
                <rect x="134" y="146" width="18" height="14" rx="3" fill="var(--care)" />
                <rect x="137" y="130" width="12" height="10" rx="3" fill="#e9eef1" />
                <ellipse cx="143" cy="178" rx="15" ry="11" fill={SKIN} />
                <path d="M130 176 q 13 -8 26 0" stroke={SKIN_SHADE} strokeWidth="2" fill="none" />
              </motion.g>
            )}

            {/* head */}
            <motion.g style={{ transformOrigin: '100px 150px' }}
              animate={rest ? { rotate: -5, y: 2 } : alert ? { rotate: 0, y: -2 } : reduce ? {} : { y: [0, -1.5, 0] }}
              transition={rest || alert ? { duration: 0.25 } : loop(4)}>
              {/* ears */}
              <ellipse cx="55" cy="104" rx="9" ry="13" fill={SKIN_SHADE} />
              <ellipse cx="145" cy="104" rx="9" ry="13" fill={SKIN_SHADE} />
              {/* face */}
              <path d="M58 88 C 58 60, 142 60, 142 88 L 142 110 C 142 140, 122 156, 100 156 C 78 156, 58 140, 58 110 Z" fill={SKIN} />
              {/* grey sideburns */}
              <path d="M58 86 L 66 86 L 66 112 C 62 110, 59 104, 58 98 Z" fill={HAIR} />
              <path d="M142 86 L 134 86 L 134 112 C 138 110, 141 104, 142 98 Z" fill={HAIR} />
              {/* cheeks */}
              <circle cx="74" cy="120" r="8" fill="#d0875e" opacity="0.45" />
              <circle cx="126" cy="120" r="8" fill="#d0875e" opacity="0.45" />

              {/* eyebrows: raised when alert */}
              <motion.g animate={{ y: alert ? -5 : 0 }} transition={{ duration: 0.2 }}>
                <path d="M70 94 q 10 -6 20 -1" stroke={HAIR} strokeWidth="5" strokeLinecap="round" fill="none" />
                <path d="M110 93 q 10 -5 20 1" stroke={HAIR} strokeWidth="5" strokeLinecap="round" fill="none" />
              </motion.g>

              {/* eyes: closed arcs when resting, blink otherwise */}
              {rest ? (
                <g stroke="#2a1d14" strokeWidth="3.5" strokeLinecap="round" fill="none">
                  <path d="M73 107 q 7 6 14 0" />
                  <path d="M113 107 q 7 6 14 0" />
                </g>
              ) : (
                <motion.g style={{ transformOrigin: '100px 106px' }}
                  animate={reduce ? {} : { scaleY: [1, 1, 0.1, 1] }}
                  transition={reduce ? {} : { duration: 4.6, times: [0, 0.94, 0.97, 1], repeat: Infinity }}>
                  <ellipse cx="80" cy="106" rx={alert ? 6.5 : 5.5} ry={alert ? 7.5 : 6.5} fill="#2a1d14" />
                  <ellipse cx="120" cy="106" rx={alert ? 6.5 : 5.5} ry={alert ? 7.5 : 6.5} fill="#2a1d14" />
                  <circle cx="82" cy="104" r="1.8" fill="#fff" />
                  <circle cx="122" cy="104" r="1.8" fill="#fff" />
                </motion.g>
              )}
              {/* smile lines (senior, friendly) */}
              <path d="M62 104 l -4 -3 M62 109 l -5 0" stroke={SKIN_SHADE} strokeWidth="1.6" strokeLinecap="round" />
              <path d="M138 104 l 4 -3 M138 109 l 5 0" stroke={SKIN_SHADE} strokeWidth="1.6" strokeLinecap="round" />

              {/* nose */}
              <path d="M100 108 q -6 14 0 17 q 4 1 6 -1" stroke={SKIN_SHADE} strokeWidth="3" strokeLinecap="round" fill="none" />
              {/* grey moustache */}
              <path d="M80 131 C 88 124, 96 126, 100 129 C 104 126, 112 124, 120 131 C 112 136, 104 133, 100 132 C 96 133, 88 136, 80 131 Z" fill={HAIR} />
              {/* mouth */}
              {state === 'speaking' ? (
                <motion.ellipse cx="100" cy="140" rx="9" ry="6" fill="#5b2a20" style={{ transformOrigin: '100px 137px' }}
                  animate={reduce ? { scaleY: 0.7 } : { scaleY: [0.35, 1, 0.55, 0.9, 0.35] }}
                  transition={loop(0.7)} />
              ) : alert ? (
                <ellipse cx="100" cy="141" rx="7" ry="5" fill="#5b2a20" />
              ) : (
                <path d="M88 138 q 12 10 24 0" stroke="#5b2a20" strokeWidth="3.5" strokeLinecap="round" fill="none" />
              )}

              {/* hard hat */}
              <path d="M50 84 C 50 44, 150 44, 150 84 Z" fill={`url(#${id('hat')})`} />
              <path d="M92 50 C 94 44, 106 44, 108 50 L 110 84 L 90 84 Z" fill={HAT_SHADE} opacity="0.55" />
              <path d="M40 84 C 40 78, 160 78, 160 84 L 160 90 C 160 94, 40 94, 40 90 Z" fill={HAT} />
              <path d="M40 90 C 70 94, 130 94, 160 90" stroke={HAT_SHADE} strokeWidth="2.5" fill="none" />
              <path d="M66 64 C 72 56, 80 52, 88 50" stroke="#fff3b0" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.8" />
            </motion.g>
          </motion.g>
        </g>
      </svg>
    </div>
  );
}

// The avatar state follows the voice: alert while a safety line plays, speaking while any other plays.
export function useAvatarState(fallback = 'idle') {
  const speaking = useStore((s) => s.speaking);
  if (speaking?.event?.priority === 'safety' && speaking.event.mode === 'alert') return 'alert';
  if (speaking) return fallback === 'rest' ? 'rest' : 'speaking';
  return fallback;
}

export function LiveAvatar({ rest = false, size }) {
  const state = useAvatarState(rest ? 'rest' : 'idle');
  return <Avatar state={state} size={size} />;
}
