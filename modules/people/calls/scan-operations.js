// The registry of in-flight scan operations per chat: begin, end, cancel, status and expiry.

export const DEFAULT_SCAN_OPERATION_TIMEOUT_MS = 5 * 60 * 1000;

export function createScanOperationRegistry({
    timeoutMs = DEFAULT_SCAN_OPERATION_TIMEOUT_MS,
    onExpire = null,
    setTimeoutFn = globalThis.setTimeout,
    clearTimeoutFn = globalThis.clearTimeout,
} = {}) {
    // key -> the operations in flight. One at a time, except operations begun `parallel` (a batch of queued backfills), which may overlap each other.
    const active = new Map();
    let sequence = 0;
    const timeout = Math.max(1000, Number(timeoutMs) || DEFAULT_SCAN_OPERATION_TIMEOUT_MS);

    const keyOf = value => String(value || '').trim();
    const listOf = key => active.get(keyOf(key)) || [];
    const isBusy = (key, { ignoreParallel = false } = {}) => listOf(key).some(operation => !(ignoreParallel && operation.metadata.parallel === true));
    const isCurrent = (key, operation) => Boolean(operation && listOf(key).includes(operation) && !operation.expired);
    const drop = (key, operation) => {
        const rest = listOf(key).filter(item => item !== operation);
        if (rest.length) active.set(keyOf(key), rest); else active.delete(keyOf(key));
    };

    const end = (key, operation) => {
        if (!operation || !listOf(key).includes(operation)) return false;
        if (operation.timer && typeof clearTimeoutFn === 'function') clearTimeoutFn(operation.timer);
        drop(key, operation);
        operation.finished = true;
        return true;
    };

    const begin = (key, label = 'scan', metadata = {}) => {
        const normalizedKey = keyOf(key);
        const meta = metadata && typeof metadata === 'object' ? structuredClone(metadata) : {};
        const others = listOf(normalizedKey);
        if (!normalizedKey || normalizedKey === 'no-chat' || (others.length && !(meta.parallel === true && others.every(item => item.metadata.parallel === true)))) return null;
        const operation = {
            id: ++sequence,
            key: normalizedKey,
            label: String(label || 'scan'),
            metadata: meta,
            startedAt: Date.now(),
            expired: false,
            finished: false,
            timer: null,
        };
        if (typeof setTimeoutFn === 'function') {
            operation.timer = setTimeoutFn(() => {
                if (!listOf(normalizedKey).includes(operation)) return;
                drop(normalizedKey, operation);
                operation.expired = true;
                operation.finished = true;
                try { onExpire?.(operation); } catch (error) { console.warn('[NPC State Delta] scan timeout cleanup callback failed', error); }
            }, timeout);
            operation.timer?.unref?.();
        }
        active.set(normalizedKey, [...others, operation]);
        return operation;
    };

    /** Cancels every operation of the chat; the operations cancelled, or [] when none ran. */
    const cancel = (key, reason = 'cancelled') => {
        const operations = [...listOf(key)];
        for (const operation of operations) {
            if (operation.timer && typeof clearTimeoutFn === 'function') clearTimeoutFn(operation.timer);
            operation.finished = true;
            operation.cancelled = true;
            operation.cancelReason = String(reason || 'cancelled');
        }
        active.delete(keyOf(key));
        return operations;
    };

    const status = key => {
        const operation = listOf(key)[0];
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
