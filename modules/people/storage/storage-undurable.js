// The snapshots of chats whose last state is not yet durable: kept in memory until a write lands, readable for recovery.

export const undurableSnapshots = new Map();

export function undurableNpcStateSnapshot(chatKey) {
    const entry = undurableSnapshots.get(String(chatKey || ''));
    return entry ? structuredClone(entry) : null;
}

export function rememberUndurableSnapshot({ chatKey, state, appVersion = '', pointer = null, error = null, recoveryOnly = false, reason = '' }) {
    const key = String(chatKey || '');
    if (!key) return;
    undurableSnapshots.set(key, {
        chatKey: key,
        state: structuredClone(state || {}),
        appVersion: String(appVersion || ''),
        pointer: pointer && typeof pointer === 'object' ? structuredClone(pointer) : null,
        errorCode: String(error?.code || ''),
        expectedRevision: Number.isFinite(Number(error?.expectedRevision)) ? Math.max(0, Math.trunc(Number(error.expectedRevision))) : null,
        actualRevision: Number.isFinite(Number(error?.actualRevision)) ? Math.max(0, Math.trunc(Number(error.actualRevision))) : null,
        recoveryOnly: recoveryOnly === true,
        reason: String(reason || '').slice(0, 160),
        rememberedAt: Date.now(),
    });
}

export function preserveUndurableNpcStateSnapshot({ chatKey, state, appVersion = '', pointer = null, error = null, reason = 'cross-session-conflict' }) {
    rememberUndurableSnapshot({ chatKey, state, appVersion, pointer, error, recoveryOnly: true, reason });
    return undurableNpcStateSnapshot(chatKey);
}
