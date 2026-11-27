// The names a reader sees for the gear's seven stats: what `gear.statLabels` answers (a module's own while it is on), else the gear's own; stored data keeps the gear's keys.
import { GEAR } from '../../modules/inventory/gear.js';

/** Seven labels in the gear's order from a `gear.statLabels` answer; null when they are the gear's own names (or the answer is not seven short words). */
export function labelsOf(answer) {
  const ok = Array.isArray(answer) && answer.length === GEAR.stats.length && answer.every(name => typeof name === 'string' && name.trim() !== '' && name.length <= 24);
  const names = ok ? answer.map(name => name.trim()) : null;
  return names && names.some((name, at) => name !== GEAR.stats[at]) ? names : null;
}

/** `text` ("+1 WIS", "+2 STR +1 DEX") with each gear stat key swapped for its label (`labels` from labelsOf); the text itself with none. */
export function relabel(text, labels) {
  if (typeof text !== 'string' || !text || !labels) return text;
  return text.replace(/\b(STR|VIT|AGI|DEX|INT|WIS|CHA)\b/g, key => labels[GEAR.stats.indexOf(key)]);
}
