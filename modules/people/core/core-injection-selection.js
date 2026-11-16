/* NPC State Delta injection selection and budget: behavior guidance, NPC relevance selection and
   token-budget normalization. Split unchanged from core-injection.js; core-injection.js re-exports
   these public names. Public face: re-exports its parts. */
export { buildBehaviorGuidance } from './core-injection-selection-parts/behavior-guidance.js';
export { scoreNpcRelevance, selectRelevantNpcs } from './core-injection-selection-parts/relevance.js';
export { DEFAULT_INJECTION_BUDGET_TOKENS, INJECTION_CAP_BASE_TOKENS, MIN_INJECTION_BUDGET_TOKENS, MAX_INJECTION_BUDGET_TOKENS } from './core-injection-selection-parts/budget-limits.js';
export { APPROX_CHARS_PER_TOKEN, normalizeInjectionBudgetTokens, estimateInjectionTokens } from './core-injection-selection-parts/budget-tokens.js';
