// The registry of in-flight scan operations per chat: begin, end, cancel, status and expiry.

export const DEFAULT_SCAN_OPERATION_TIMEOUT_MS = 5 * 60 * 1000;

export function createScanOperationRegistry({
    timeoutMs = DEFAULT_SCAN_OPERATION_TIMEOUT_MS,
    onExpire = null,
    setTimeoutFn = globalThis.setTimeout,
    clearTimeoutFn = globalThis.clearTimeout,
} = {}) {
    const active = new Map();
    let sequence = 0;
    const timeout = Math.max(1000, Number(timeoutMs) || DEFAULT_SCAN_OPERATION_TIMEOUT_MS);

    const keyOf = value => String(value || '').trim();
    const isBusy = key => active.has(keyOf(key));
    const isCurrent = (key, operation) => Boolean(operation && active.get(keyOf(key)) === operation && !operation.expired);

    const end = (key, operation) => {
        const normalizedKey = keyOf(key);
        if (!operation || active.get(normalizedKey) !== operation) return false;
        if (operation.timer && typeof clearTimeoutFn === 'function') clearTimeoutFn(operation.timer);
        active.delete(normalizedKey);
        operation.finished = true;
        return true;
    };

    const begin = (key, label = 'scan', metadata = {}) => {
        const normalizedKey = keyOf(key);
        if (!normalizedKey || normalizedKey === 'no-chat' || active.has(normalizedKey)) return null;
        const operation = {
            id: ++sequence,
            key: normalizedKey,
            label: String(label || 'scan'),
            metadata: metadata && typeof metadata === 'object' ? structuredClone(metadata) : {},
            startedAt: Date.now(),
            expired: false,
            finished: false,
            timer: null,
        };
        if (typeof setTimeoutFn === 'function') {
            operation.timer = setTimeoutFn(() => {
                if (active.get(normalizedKey) !== operation) return;
                active.delete(normalizedKey);
                operation.expired = true;
                operation.finished = true;
                try { onExpire?.(operation); } catch (error) { console.warn('[NPC State Delta] scan timeout cleanup callback failed', error); }
            }, timeout);
            operation.timer?.unref?.();
        }
        active.set(normalizedKey, operation);
        return operation;
    };

    const cancel = (key, reason = 'cancelled') => {
        const normalizedKey = keyOf(key);
        const operation = active.get(normalizedKey);
        if (!operation) return null;
        if (operation.timer && typeof clearTimeoutFn === 'function') clearTimeoutFn(operation.timer);
        active.delete(normalizedKey);
        operation.finished = true;
        operation.cancelled = true;
        operation.cancelReason = String(reason || 'cancelled');
        return operation;
    };

    const status = key => {
        const operation = active.get(keyOf(key));
        if (!operation) return null;
        return {
            id: operation.id,
            key: operation.key,
            label: operation.label,
            metadata: structuredClone(operation.metadata || {}),
            startedAt: operation.startedAt,
        };
    };

    return Object.freeze({ begin, end, cancel, isBusy, isCurrent, status });
}
