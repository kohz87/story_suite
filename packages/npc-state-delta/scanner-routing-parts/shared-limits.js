/* NPC State Delta: the scanner request timeout and the output-token limits. */

export const SCANNER_REQUEST_TIMEOUT_MS = 5 * 60 * 1000;
export const SCANNER_MAX_OUTPUT_TOKENS_MIN = 128;
export const SCANNER_MAX_OUTPUT_TOKENS_MAX = 15000;

export function normalizeScannerMaxOutputTokens(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number <= 0) return 0;
    return Math.max(SCANNER_MAX_OUTPUT_TOKENS_MIN, Math.min(SCANNER_MAX_OUTPUT_TOKENS_MAX, Math.round(number)));
}
