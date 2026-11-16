// The plain cause text of a mood: cleaning a reason and the cause line of one event.
import { hasOwn, flatText } from './shared-checks.js';

export const CAUSE_MAX = 80;

const EVENT_LABELS = Object.freeze({
  'trust-drop': 'trust dropped',
  betrayal: 'betrayed',
  rest: 'rested',
  safe: 'felt safe',
});

/** Plain text capped at CAUSE_MAX characters; a longer text ends in an ellipsis. Idempotent. */
export function cleanReason(text) {
  const flat = flatText(text);
  return flat.length > CAUSE_MAX ? `${flat.slice(0, CAUSE_MAX - 1).trimEnd()}…` : flat;
}

/**
 * The cause text for one event: "trust dropped: Astra lied", "betrayed", "rested". The reason is the story's own
 * reason label (reason|why|because|note|cause), flattened and capped. An unknown kind gives ''.
 */
export function causeText(kind, reason) {
  if (!hasOwn(EVENT_LABELS, kind)) return '';
  const why = flatText(reason);
  return cleanReason(why ? `${EVENT_LABELS[kind]}: ${why}` : EVENT_LABELS[kind]);
}
