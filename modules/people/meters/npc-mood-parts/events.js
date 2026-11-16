// Applying events to a mood and deriving the events of one reply from its trust moves.
import { hasOwn, isFiniteNumber } from './shared-checks.js';
import { clampAxis, dayOf } from './axes.js';
import { causeText } from './text.js';
import { TRUST_DROP_MIN, BETRAYAL_TRUST, SEVERE_DROP_MIN } from './thresholds.js';
import { EVENT_DELTAS } from './timing.js';
import { decayMood } from './settle.js';

/**
 * The mood after `events` at story minute `minutes`: settle toward rest first, then each known event's delta in order, clamped
 * after each step; an event re-anchors the easing (from = the new axes, at = now). events: [{ kind: 'trust-drop' | 'betrayal' | 'rest' | 'safe', reason? }]; unknown kinds are skipped.
 * The cause becomes the last known event's cause text; with no known event the stored cause stays.
 */
export function applyEvents(mood, minutes, events) {
  let next = decayMood(mood, minutes);
  let hit = false;
  let cause = next.cause;
  for (const event of Array.isArray(events) ? events : []) {
    const kind = event?.kind;
    if (!hasOwn(EVENT_DELTAS, kind)) continue;
    const delta = EVENT_DELTAS[kind];
    next = {
      ...next,
      v: clampAxis(next.v + delta.v),
      a: clampAxis(next.a + delta.a),
      d: clampAxis(next.d + delta.d),
    };
    cause = causeText(kind, event.reason);
    hit = true;
  }
  return hit ? { ...next, cause, at: dayOf(minutes), from: { v: next.v, a: next.a, d: next.d } } : { ...next, cause };
}

/**
 * The events one reply makes for one NPC, from that NPC's own meter moves in the reply.
 * moves: [{ meter: 'trust', change: -12 }], the applied change after the per-reply caps (several trust rows are summed).
 * opts: { reason, impact } where impact is the reply's tier label ('ordinary' | 'meaningful' | 'major' | 'extreme').
 * A trust change of -6 or worse is a betrayal; so is -3 or worse at a major or extreme impact. A smaller drop is a
 * trust drop. A rise or no change gives no event.
 */
export function eventsFromMoves(moves, opts = {}) {
  const trust = Array.isArray(moves) ? moves.filter(m => m && m.meter === 'trust' && isFiniteNumber(m.change)) : [];
  const change = trust.reduce((sum, m) => sum + m.change, 0);
  if (!(change < 0)) return [];
  const severe = opts?.impact === 'major' || opts?.impact === 'extreme';
  let kind = null;
  if (change <= -BETRAYAL_TRUST || (severe && change <= -SEVERE_DROP_MIN)) kind = 'betrayal';
  else if (change <= -TRUST_DROP_MIN) kind = 'trust-drop';
  return kind ? [{ kind, reason: opts?.reason ?? '' }] : [];
}
