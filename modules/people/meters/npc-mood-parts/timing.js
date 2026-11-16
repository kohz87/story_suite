// The settling and event constants: the story day length, each axis's half-life, the rest limit and the event deltas.

// One step per event on each axis. Between events each axis eases toward the resting mood: the further away, the bigger the
// step back (halves every HALF_LIFE minutes, integer, never past rest). Arousal about half every 3.5 story hours, valence
// about gone in 1-2 days, dominance about 3 days. New events add on top of whatever is left.

export const DAY_MIN = 1440;
export const HALF_LIFE = Object.freeze({ a: 210, v: 720, d: 1620 });
export const REST_LIMIT = 2;

export const EVENT_DELTAS = Object.freeze({
  'trust-drop': Object.freeze({ v: -1, a: 1, d: -1 }),
  betrayal: Object.freeze({ v: -2, a: 2, d: -1 }),
  rest: Object.freeze({ v: 1, a: -1, d: 0 }),
  safe: Object.freeze({ v: 1, a: 0, d: 1 }),
});
