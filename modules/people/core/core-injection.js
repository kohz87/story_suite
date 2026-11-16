/* NPC State Delta prompt injection assembly: buildInjection over the selected/relevant cast and
   optional reference blocks. Selection/budget and block-rendering helpers live in
   core-injection-selection.js and core-injection-parts.js; core-mechanics.js re-exports every name
   it exported before. Never imports core-mechanics.js or core.js. Public face: re-exports its parts. */
export { buildInjection } from './core-injection-parts/build.js';
export { buildBehaviorGuidance, scoreNpcRelevance, selectRelevantNpcs, DEFAULT_INJECTION_BUDGET_TOKENS, MIN_INJECTION_BUDGET_TOKENS, MAX_INJECTION_BUDGET_TOKENS, normalizeInjectionBudgetTokens, estimateInjectionTokens } from './core-injection-selection.js';
