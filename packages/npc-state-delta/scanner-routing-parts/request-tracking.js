/* NPC State Delta: the in-flight scanner requests, the call metrics and their cancel and read-out. */

export const inflight = new Map();

export const metrics = {
    attempts: 0, total: 0, defaultRoute: 0, profileRoute: 0,
    succeeded: 0, failed: 0, rejected: 0, timedOut: 0, cancelled: 0, last: null,
};

export function cancelScannerRequests(_reason = 'cancelled', { chatKey, operationId, timedOut = false } = {}) {
    let count = 0;
    for (const entry of inflight.values()) {
        if (chatKey !== undefined && entry.record.chatKey !== chatKey) continue;
        if (operationId !== undefined && entry.record.operationId !== operationId) continue;
        if (entry.controller.signal.aborted) continue;
        entry.cancel(timedOut);
        count += 1;
    }
    return count;
}

export function scannerRoutingMetrics() {
    return { ...metrics, inflight: inflight.size, last: metrics.last ? { ...metrics.last } : null };
}
