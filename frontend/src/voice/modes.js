// Voice settings per mode. Tune by ear later.
export const MODES = {
  friendly: { pitch: 1.0, rate: 1.0, volume: 0.9 },
  alert: { pitch: 1.3, rate: 1.15, volume: 1.0 },
  care: { pitch: 0.9, rate: 0.85, volume: 0.8 },
  debrief: { pitch: 1.0, rate: 1.0, volume: 0.9 },
};

export function modeSettings(mode) {
  return MODES[mode] ?? MODES.friendly;
}
