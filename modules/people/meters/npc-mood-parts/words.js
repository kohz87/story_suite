// The one word for a mood from the 3x3 table, the band of an axis and the word the scanner stored.
import { clampAxis } from './axes.js';
import { MOOD_BAND_EDGE } from './thresholds.js';
import { neutralMood, normalizeMood } from './state.js';

// Rows: valence band (-1 unpleasant, 0 neutral, 1 pleasant). Columns: arousal band (-1 low, 0 mid, 1 high).
export const MOOD_WORDS = Object.freeze([
  Object.freeze(['Wary', 'Tense', 'Alarmed']),
  Object.freeze(['Flat', 'Steady', 'Restless']),
  Object.freeze(['Calm', 'Content', 'Eager']),
]);

/** The band of one axis: -1 at -2 or below, 1 at 2 or above, else 0. */
export function bandOf(value) {
  const n = clampAxis(value);
  if (n <= -MOOD_BAND_EDGE) return -1;
  return n >= MOOD_BAND_EDGE ? 1 : 0;
}

/** The one word for a mood, from the 3x3 table by valence and arousal bands. Dominance is not in the table. */
export function moodWord(mood) {
  const m = normalizeMood(mood) ?? neutralMood();
  return MOOD_WORDS[bandOf(m.v) + 1][bandOf(m.a) + 1];
}

/**
 * The word the scanner stored for a mood, read from its cause ("now pragmatic/amused" or "now curt — why", see applyWord), lower case, at most 30 characters;
 * '' when the cause is not a word line (an event cause such as "trust dropped: ..." or none). The prompt line prints this word, never a band word of the numbers.
 */
export function storedMoodWord(mood) {
  const cause = typeof mood?.cause === 'string' ? mood.cause : '';
  const match = /^now (.+?)(?: — .*)?$/.exec(cause);
  const word = match ? match[1].trim().toLowerCase().slice(0, 30).trim() : '';
  return word && word !== 'mood word not rated' ? word : '';
}
