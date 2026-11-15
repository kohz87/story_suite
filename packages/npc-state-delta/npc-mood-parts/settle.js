// Settling a mood toward a person's resting mood over story time, and reading that resting mood from temperament words.
import { clampAxis, dayOf } from './axes.js';
import { DAY_MIN, HALF_LIFE, REST_LIMIT } from './timing.js';
import { neutralMood, normalizeMood } from './state.js';

/** One axis eased from `from` toward `rest` over `minutes`: magnitude x 2^-(minutes/half) in integers (linear between halvings, rounded half up), never past rest. */
export function easeAxis(from, rest, minutes, half) {
  const dist = from - rest;
  if (!dist || !(minutes > 0)) return from;
  const mag = Math.abs(dist);
  const whole = Math.min(40, Math.floor(minutes / half));
  const den = 2 * half * 2 ** whole;
  const left = Math.min(mag, Math.floor((2 * mag * (2 * half - (minutes - whole * half)) + den) / (2 * den)));
  return rest + (dist < 0 ? -left : left);
}

/** A person's resting mood from their temperament words (pack personality / first description): -2..2 per axis, 0,0,0 when no word is known. */
const TEMPER = Object.freeze({
  v: [[/\b(cheerful|warm|kind|gentle|joyful|optimistic|sunny|genial|easygoing|affectionate)\b/g, 1], [/\b(bitter|gloomy|sullen|cold|morose|pessimistic|cynical|brooding|grim|melancholy)\b/g, -1]],
  a: [[/\b(energetic|excitable|restless|fiery|hot-headed|jumpy|nervous|eager|hyper|volatile)\b/g, 1], [/\b(calm|serene|placid|lethargic|stoic|unhurried|sleepy|relaxed|composed)\b/g, -1]],
  d: [[/\b(confident|commanding|bold|assertive|authoritative|proud|fearless|domineering)\b/g, 1], [/\b(timid|meek|anxious|shy|submissive|fearful|insecure|hesitant|nervous)\b/g, -1]],
});

export function restingMood(...texts) {
  const text = texts.filter(item => typeof item === 'string').join(' ').toLowerCase();
  const out = { v: 0, a: 0, d: 0 };
  for (const axis of Object.keys(TEMPER)) {
    const sum = TEMPER[axis].reduce((total, [word, sign]) => total + sign * (text.match(word)?.length ?? 0), 0);
    out[axis] = Math.max(-REST_LIMIT, Math.min(REST_LIMIT, sum));
  }
  return out;
}

/** A fresh mood sitting at a resting mood at story minute `at` (axes = rest, no cause). */
export function restMood(rest, at = 0) {
  const r = { v: clampAxis(rest?.v), a: clampAxis(rest?.a), d: clampAxis(rest?.d) };
  const minute = dayOf(at);
  return { v: r.v, a: r.a, d: r.d, day: Math.floor(minute / DAY_MIN), cause: '', at: minute, from: { v: r.v, a: r.a, d: r.d }, rest: { v: r.v, a: r.a, d: r.d } };
}

/**
 * The mood settled to story minute `minutes`: each axis eased from the anchor (`from` at `at`) toward the resting mood by its
 * own speed, so it does not matter how often this runs. Never past rest; the cause, anchor and rest are kept. Pure.
 */
export function decayMood(mood, minutes) {
  const base = normalizeMood(mood) ?? neutralMood(Math.floor(dayOf(minutes) / DAY_MIN));
  const now = dayOf(minutes);
  const at = base.at ?? base.day * DAY_MIN;
  const from = base.from ?? { v: base.v, a: base.a, d: base.d };
  const rest = base.rest ?? { v: 0, a: 0, d: 0 };
  const elapsed = Math.max(0, now - at);
  const ease = axis => clampAxis(easeAxis(from[axis], rest[axis], elapsed, HALF_LIFE[axis]));
  return { v: ease('v'), a: ease('a'), d: ease('d'), day: Math.max(base.day, Math.floor(now / DAY_MIN)), cause: base.cause, at, from, rest };
}
