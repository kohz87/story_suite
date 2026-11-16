/* NPC State Delta: the scanner routing error shape and the stop and empty-answer tests. */

export function scannerRoutingError(message, code = 'NPC_SCANNER_PROFILE_UNAVAILABLE') {
    const error = new Error(`NPC State Delta scanner: ${message}`);
    error.name = 'NPCStateDeltaScannerRouteError';
    error.code = code;
    return error;
}

export function isScannerRoutingError(error) {
    return error?.name === 'NPCStateDeltaScannerRouteError';
}

/**
 * (beta) True when a scanner call failed only because the model answered nothing (SillyTavern's
 * generateRaw "No message generated", or an empty response): index.js notes it quietly, once per chat.
 */
export function isEmptyScannerAnswer(error) {
    return /\bno message generated\b|\bempty (?:response|reply|answer)\b/i.test(String(error?.message ?? error ?? ''));
}

export function stoppedError(timeout = false) {
    return scannerRoutingError(timeout
        ? 'The scan request timed out. Retry Scan or check the selected connection profile.'
        : 'The scan was cancelled or its chat/dossier source changed; its result was discarded.',
    timeout ? 'NPC_SCANNER_ROUTE_TIMEOUT' : 'NPC_SCANNER_ROUTE_CANCELLED');
}
