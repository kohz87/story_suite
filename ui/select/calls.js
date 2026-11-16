// Builds the Models page's "Calls" group: the queue switch, the priority note, the fallback call and what it may write, and the People call's output limit.

import { KIND_CHOICES, allowedKinds } from '../../modules/assist/safety.js';

const GROUP = 'Calls';
const FALLBACK = 'story-block.extractor';
const row = (key, type, label, value, more = {}) => ({ key, group: GROUP, type, label, value, default: null, options: null, hint: null, unit: null, tags: [], wide: false, ...more });

/**
 * `calls`: { queue (host callQueue), kinds (the stored assistExtractorKinds text, or undefined), maxOutput (People's scannerMaxOutputTokens, or undefined) };
 * `features`: the feature list (the fallback is `story-block.extractor`). → the group's contract rows, in the mock's order.
 */
export function selectCalls(calls, features) {
  const fallback = (Array.isArray(features) ? features : []).find(f => f?.id === FALLBACK);
  const kinds = allowedKinds(calls?.kinds ?? undefined);
  return [
    row('calls.queue', 'sw', 'One call at a time per connection', calls?.queue === true, { hint: 'A local server is never asked twice at once' }),
    row('calls.priority', 'info', 'Calls the reply waits on go first', 'always on', { hint: 'A priority queue: pre-roll checks, fight set-up and cast moves go ahead of planner work on the same connection, and arc plans never start while a reply is being sent' }),
    row('calls.fallback', 'sw', 'Fallback when a reply forgot its lines', fallback?.on === true, { hint: 'One extra call, only when the whole change block is missing', tags: ['cost:model call'] }),
    row('calls.maxOutput', 'info', 'Most output per People call', Number.isFinite(calls?.maxOutput) && calls.maxOutput > 0 ? `${calls.maxOutput} tokens` : 'built-in limits', { hint: '0 keeps the built-in limits; the planner has its own (Director). Set in the old view’s NPC State settings' }),
    row('calls.kinds', 'chips', 'The fallback may write', KIND_CHOICES.filter(k => kinds.has(k.value)).map(k => k.label), { hint: 'The ten kinds on by default; world news and faction lines are optional', options: KIND_CHOICES.map(k => k.label), wide: true }),
  ];
}
