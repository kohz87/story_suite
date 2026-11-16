/* NPC State one-pass lines builder (not wired yet; NPC State Batch 2, N0). The prompt for the `~` line grammar that will replace the JSON one-pass
   block: the rules (cached, the same every reply) and the context (changes every reply). Both are empty until the builder is filled in; nothing
   imports this file except its test, so no prompt changes. Public face: re-exports its parts. */
export { buildLinesRules } from './core-prompts-lines-parts/rules.js';
export { buildLinesContext } from './core-prompts-lines-parts/context.js';

import { buildLinesRules } from './core-prompts-lines-parts/rules.js';
import { buildLinesContext } from './core-prompts-lines-parts/context.js';

/** `{ rules, context }` for one set of settings, in the shape the one-pass prompt has today. */
export function buildLinesParts(options = {}) {
    return { rules: buildLinesRules(options), context: buildLinesContext(options) };
}
