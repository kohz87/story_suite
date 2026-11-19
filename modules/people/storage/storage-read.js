// Reads a chat's sidecar from its pointer: checks it belongs to the chat and decodes its payload.

import { NPC_STATE_FILE_FORMAT, NPC_STATE_FILE_FORMAT_VERSION } from './storage-payload.js';
import { durabilityQueue } from './storage-write.js';
import { undurableSnapshots } from './storage-undurable.js';
import { writerId } from './storage-self.js';
import { adoptNpcStateDataFileMetadata, inspectNpcStateDataFile } from './storage-inspect.js';

export async function readNpcStateDataFile(pointer, { fetchFn = globalThis.fetch, expectedChatKey = '', probeHeaders = null } = {}) {
    const pendingKey = String(expectedChatKey || '');
    const pending = pendingKey ? durabilityQueue.get(pendingKey) : null;
    const shadow = pendingKey ? undurableSnapshots.get(pendingKey) : null;
    const resident = pending && !pending.cancelled ? pending : (shadow?.recoveryOnly ? null : shadow);
    if (resident) {
        return {
            format: NPC_STATE_FILE_FORMAT,
            version: NPC_STATE_FILE_FORMAT_VERSION,
            appVersion: String(resident.appVersion || ''),
            chatKey: pendingKey,
            updatedAt: new Date(Number(resident.rememberedAt || Date.now())).toISOString(),
            retired: false,
            reason: '',
            revision: Math.max(0, Math.trunc(Number(pointer?.revision) || 0)),
            writerId,
            state: structuredClone(resident.recoveryState ? resident.recoveryState() : (resident.state || {})),
            undurable: true,
        };
    }
    if (!pointer?.path) return null;
    if (typeof fetchFn !== 'function') throw new Error('fetch() is unavailable for NPC State data-file persistence.');
    const inspected = await inspectNpcStateDataFile(pointer, { fetchFn, expectedChatKey, probeHeaders });
    if (!inspected.exists) return null;
    // Full hydration is the point at which a caller deliberately adopts the durable revision.
    // A cheap freshness probe uses inspectNpcStateDataFile() directly and never mutates this
    // token before deciding whether a dirty working copy conflicts with the server.
    adoptNpcStateDataFileMetadata(pointer, inspected);
    return inspected.payload;
}
