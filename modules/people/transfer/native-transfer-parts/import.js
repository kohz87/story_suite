// Preparing a native bundle for import into a target chat, clearing source-message ownership of a foreign chat.
import { encodeNpcStateBundle } from '../bundle.js';
import { augmentNativeBundle } from './augment.js';
import { decodeDeltaNativeBundle } from './decode.js';

function scrubSourceMessageOwnership(value) {
    if (Array.isArray(value)) return value.map(scrubSourceMessageOwnership);
    if (!value || typeof value !== 'object') return value;
    const out = {};
    for (const [key, item] of Object.entries(value)) {
        const normalizedKey = String(key || '').replace(/_/g, '').toLowerCase();
        if (['speechdevelopment', 'personalitydevelopment'].includes(normalizedKey)
            && item && typeof item === 'object' && !Array.isArray(item)) {
            const ledger = scrubSourceMessageOwnership(item);
            // Pending durable-profile observations are chronological source-chat evidence,
            // not portable characterization. Keep the accepted epoch/baseline text but rebase
            // pending Personality/Speech provenance onto the target chat's safe history baseline.
            out[key] = { ...ledger, baselineTurn: null, baselineSourceMessageId: null, concepts: [] };
            continue;
        }
        if (/^(?:.*SourceMessageIds?|requestedMessageId|restoredFromMessageId)$/i.test(key)) {
            out[key] = Array.isArray(item) ? [] : null;
        } else out[key] = scrubSourceMessageOwnership(item);
    }
    return out;
}

export function nativeStateForTarget(decoded, targetChatKey) {
    const target = String(targetChatKey || '').trim();
    if (!target || target === 'no-chat') throw new Error('Open the target chat before importing NPC State Delta data.');
    return decoded.metadata.sourceChatKey !== target ? scrubSourceMessageOwnership(decoded.state) : decoded.state;
}

export function prepareNativeImport(input, targetChatKey) {
    const decoded = decodeDeltaNativeBundle(input);
    const target = String(targetChatKey || '').trim();
    if (!target || target === 'no-chat') throw new Error('Open the target chat before importing NPC State Delta data.');
    const foreignOwnership = decoded.metadata.sourceChatKey !== target;
    const safeState = nativeStateForTarget(decoded, target);
    const base = encodeNpcStateBundle(safeState, {
        appVersion: decoded.metadata.appVersion || 'unknown',
        // Preserve the declared source identity until the canonical importer applies the
        // prepared bundle. Re-labeling it as the target here would erase the proof that
        // activity counters and other chronology came from a different chat.
        chatKey: decoded.metadata.sourceChatKey || target,
    });
    const importBytes = augmentNativeBundle(base, {
        portableSettings: decoded.portableSettings,
        historyArchive: decoded.historyArchive,
    });
    return {
        decoded,
        importBytes,
        ownershipPolicy: foreignOwnership ? 'source-message ownership cleared; target history baseline retained' : 'same-chat ownership retained by canonical importer',
        historyPolicy: decoded.historyArchive ? 'source history included for audit only; target checkpoints/lineage are not replaced' : 'no source history archive declared; target checkpoints/lineage are not replaced',
    };
}
