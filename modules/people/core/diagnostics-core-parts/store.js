// The bounded per-chat diagnostic store and bundle exporter, with the bundle version and default operation limit.
import { clean, finiteInt, uniqueStrings } from './shared-clean.js';
import { sanitizeDiagnosticOperation } from './sanitize-operation.js';

export const DIAGNOSTIC_BUNDLE_VERSION = 3;
export const DEFAULT_DIAGNOSTIC_OPERATION_LIMIT = 40;

function fnv1a(value) {
    let hash = 2166136261;
    for (const ch of String(value ?? '')) {
        hash ^= ch.charCodeAt(0);
        hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
}
export function createDiagnosticStore({ limit = DEFAULT_DIAGNOSTIC_OPERATION_LIMIT, now = () => Date.now() } = {}) {
    const max = Math.max(8, Math.min(128, finiteInt(limit, DEFAULT_DIAGNOSTIC_OPERATION_LIMIT)));
    const byChat = new Map();
    let sequence = 0;
    function list(chatKey) {
        const key = clean(chatKey, 500);
        if (!byChat.has(key)) byChat.set(key, []);
        return byChat.get(key);
    }
    function record(chatKey, raw = {}) {
        const key = clean(chatKey, 500);
        if (!key || key === 'no-chat') return null;
        const normalized = sanitizeDiagnosticOperation({ ...raw, at: raw.at ?? now() });
        sequence += 1;
        normalized.id = normalized.id || `${normalized.at.toString(36)}-${sequence.toString(36)}`;
        const rows = list(key);
        rows.push(normalized);
        if (rows.length > max) rows.splice(0, rows.length - max);
        return structuredClone(normalized);
    }
    function records(chatKey, { npcId = '', limit: requested = max } = {}) {
        const id = clean(npcId, 160);
        const count = Math.max(1, Math.min(max, finiteInt(requested, max)));
        const rows = list(chatKey).filter(row => !id || row.npcIds.includes(id));
        return structuredClone(rows.slice(-count));
    }
    function clear(chatKey) {
        const key = clean(chatKey, 500);
        const count = byChat.get(key)?.length || 0;
        byChat.delete(key);
        return count;
    }
    function summary(chatKey) {
        const rows = list(chatKey);
        const profileRows = rows.reduce((sum, row) => sum + row.profile.length, 0);
        const birthdayRows = rows.reduce((sum, row) => sum + row.birthdays.length, 0);
        const npcIds = uniqueStrings(rows.flatMap(row => row.npcIds), 128, 160);
        return { operationCount: rows.length, profileRows, birthdayRows, npcCount: npcIds.length, limit: max, latest: rows.at(-1)?.id || null };
    }
    function bundle(chatKey, { applicationVersion = '' } = {}) {
        const key = clean(chatKey, 500);
        return {
            diagnosticVersion: DIAGNOSTIC_BUNDLE_VERSION,
            deltaApplicationVersion: clean(applicationVersion, 32),
            exportedAt: now(),
            chatIdentityHash: fnv1a(key),
            retentionLimit: max,
            privacy: 'Compact allowlisted deterministic diagnostics only; no full story, prompts, credentials, or provider payloads.',
            operations: records(key),
        };
    }
    return Object.freeze({ record, records, clear, summary, bundle });
}
