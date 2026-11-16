/* NPC State Delta injection budget tokens: the characters-per-token estimate, budget normalization and token estimation. */
import { DEFAULT_INJECTION_BUDGET_TOKENS, MAX_INJECTION_BUDGET_TOKENS, MIN_INJECTION_BUDGET_TOKENS } from './budget-limits.js';

export const APPROX_CHARS_PER_TOKEN = 4;

export function normalizeInjectionBudgetTokens(value) {
    return Math.max(MIN_INJECTION_BUDGET_TOKENS, Math.min(MAX_INJECTION_BUDGET_TOKENS, Math.round(Number(value) || DEFAULT_INJECTION_BUDGET_TOKENS)));
}

export function estimateInjectionTokens(text) {
    return Math.ceil(String(text || '').length / APPROX_CHARS_PER_TOKEN);
}
