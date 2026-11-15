// The mood record: the neutral starting mood and cleaning a stored mood to its shape.
import { isFiniteNumber } from './shared-checks.js';
import { clampAxis, dayOf } from './axes.js';
import { cleanReason } from './text.js';

/** The starting mood on a given story day: every axis 0, no cause. */
export function neutralMood(day = 0) {
  return { v: 0, a: 0, d: 0, day: dayOf(day), cause: '' };
}

/**
 * A stored mood record cleaned to its shape: axes clamped to -3..3, day a whole number >= 0, cause capped plain text.
 * Absent or non-object input gives null (an old record without `mood`). Idempotent.
 */
export function normalizeMood(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const axes = value => (value && typeof value === 'object' && !Array.isArray(value) ? { v: clampAxis(value.v), a: clampAxis(value.a), d: clampAxis(value.d) } : null);
  const from = axes(raw.from);
  const rest = axes(raw.rest);
  return {
    v: clampAxis(raw.v),
    a: clampAxis(raw.a),
    d: clampAxis(raw.d),
    day: dayOf(raw.day),
    cause: cleanReason(raw.cause),
    ...(isFiniteNumber(raw.at) ? { at: dayOf(raw.at) } : {}),
    ...(from ? { from } : {}),
    ...(rest ? { rest } : {}),
  };
}
