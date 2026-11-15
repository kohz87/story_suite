// The Energy and Control bars of a mood as steps 0..6.
import { MOOD_MIN, MOOD_MAX } from './axes.js';
import { neutralMood, normalizeMood } from './state.js';

/** The Energy (arousal) and Control (dominance) bars as steps 0..6, where 3 is the middle. */
export function moodBars(mood) {
  const m = normalizeMood(mood) ?? neutralMood();
  return { energy: m.a - MOOD_MIN, control: m.d - MOOD_MIN, max: MOOD_MAX - MOOD_MIN };
}
