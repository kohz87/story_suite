// Default relevance settings and token estimation.

export const DEFAULTS = { budgetTokens: 1000, dormantReplies: 15, dormantDays: 30, dueSoonDays: 3 };

export function estimateTokens(text) {
    return Math.ceil(String(text ?? '').length / 4);
}
