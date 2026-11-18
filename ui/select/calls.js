// Builds the Models page's "Calls" group: the queue switch, the priority note, the fallback call and what it may write, and the People call's output limit.

import { KIND_CHOICES, allowedKinds } from '../../modules/assist/safety.js';
import { SCANNER_MAX_OUTPUT_TOKENS_MAX, SCANNER_MAX_OUTPUT_TOKENS_MIN, normalizeScannerMaxOutputTokens } from '../../modules/people/calls/scanner-routing-parts/shared-limits.js';
import { DEFAULTS, FEATURE_TEXT, SETTING } from '../../modules/assist/common.js';

const GROUP = 'Calls';
const FALLBACK = 'story-block.extractor';
const row = (key, type, label, value, more = {}) => ({ key, group: GROUP, type, label, value, default: null, options: null, hint: null, unit: null, tags: [], wide: false, ...more });

/**
 * `calls`: { queue (host callQueue), keepBlocks (host keepRecentBlocks, default on), repair (the stored assistRepair, or undefined: then the default, on), kinds (the stored assistExtractorKinds text, or undefined), maxOutput (People's scannerMaxOutputTokens, or undefined) };
 * `features`: the feature list (the fallback is `story-block.extractor`). → the group's contract rows, in the mock's order.
 */
export function selectCalls(calls, features) {
  const fallback = (Array.isArray(features) ? features : []).find(f => f?.id === FALLBACK);
  const kinds = allowedKinds(calls?.kinds ?? undefined);
  return [
    row('calls.queue', 'sw', 'One call at a time per connection', calls?.queue === true, { hint: 'A local server is never asked twice at once' }),
    row('calls.priority', 'info', 'Calls the reply waits on go first', 'always on', { hint: 'A priority queue: pre-roll checks, fight set-up and cast moves go ahead of planner work on the same connection, and arc plans never start while a reply is being sent' }),
    row('calls.repair', 'sw', FEATURE_TEXT.repair.label, (calls?.repair ?? DEFAULTS[SETTING.repair]) === true, { hint: 'Runs only when a reply has no change block at all: one call on the Quick connection writes the block from the story, coin and items too. The lines are marked Assist and can be discarded per reply, in that reply’s sheet (Discard repair)', tags: ['cost:model call'] }),
    row('calls.keepBlocks', 'sw', 'Keep the last two replies’ change blocks in the prompt', calls?.keepBlocks === true, { hint: 'The two newest replies reach the model with the change block the narrator wrote for them. On by default; about 0.7-3k characters more per prompt (measured live), no extra call', tags: ['cost:tokens'] }),
    row('calls.fallback', 'sw', 'Fallback when a reply forgot its lines', fallback?.on === true, { hint: 'Runs after each reply, on the Background connection: adds time, place, who came or went and quest progress the change lines missed, marked Assist. Never coin or items (Repair writes those)', tags: ['cost:model call'] }),
    row('calls.maxOutput', 'num', 'Most output per People call', normalizeScannerMaxOutputTokens(calls?.maxOutput), { default: 0, unit: 'tokens', hint: `0 keeps the built-in limits; otherwise ${SCANNER_MAX_OUTPUT_TOKENS_MIN} to ${SCANNER_MAX_OUTPUT_TOKENS_MAX}, for every People call; the planner has its own (Director)` }),
    row('calls.kinds', 'chips', 'The fallback may write', KIND_CHOICES.filter(k => kinds.has(k.value)).map(k => k.label), { hint: 'The ten kinds on by default; world news and faction lines are optional', options: KIND_CHOICES.map(k => k.label), wide: true }),
  ];
}
