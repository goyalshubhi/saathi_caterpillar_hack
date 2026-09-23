// Number that counts up from 0 when it appears (instant when reduced motion is preferred).
import { useEffect, useRef } from 'react';
import { animate, useReducedMotion } from 'framer-motion';

export default function CountUp({ value, duration = 0.9, className }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  useEffect(() => {
    const node = ref.current;
    if (!node) return undefined;
    if (reduce || value == null) {
      node.textContent = value ?? '–';
      return undefined;
    }
    const controls = animate(0, value, {
      duration,
      ease: 'easeOut',
      onUpdate: (v) => { node.textContent = String(Math.round(v)); },
    });
    return () => controls.stop();
  }, [value, duration, reduce]);
  return <span ref={ref} className={className} data-value={value}>{value ?? '–'}</span>;
}
