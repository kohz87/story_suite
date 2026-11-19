// Sets an unreadable sidecar aside as a recovery copy, and retires a chat's sidecar when its chat is gone.

import { decodeStateFilePayload } from './storage-payload.js';
import { uploadPayload } from './storage-files.js';
import { cancelPendingNpcStateWrite } from './storage-write.js';
import { withWriterLock } from './storage-locks.js';
import { makeNpcStateDataFileName, makeNpcStateRecoveryFileName } from './storage-names.js';
import { encodeRetiredStateFilePayload } from './storage-encode.js';
import { writerId } from './storage-self.js';
import { remoteRevision } from './storage-inspect.js';

// Detach of an unreadable sidecar: copy its exact bytes to a recovery file (verified), then replace
// the canonical file with a retired marker, which a fresh unpointered write may replace. Without
// this, the deterministic path still holds the unreadable bytes and every fresh write fails on them.
export async function quarantineUnreadableNpcStateDataFile({ chatKey, pointer, appVersion = '', fetchFn = globalThis.fetch, headers = {}, onPreserved = null }) {
    if (typeof fetchFn !== 'function') throw new Error('fetch() is unavailable for NPC State data-file persistence.');
    const key = String(chatKey || '');
    if (!pointer?.path) return null;
    cancelPendingNpcStateWrite(key);
    return withWriterLock(key, async () => {
        const response = await fetchFn(pointer.path, { method: 'GET', cache: 'no-store' });
        if (response?.status === 404) return null;
        if (!response?.ok) throw new Error(`NPC State could not read the broken sidecar to preserve it (HTTP ${response?.status || 'error'}).`);
        const raw = typeof response.text === 'function' ? await response.text() : '';
        // A retry after an uncertain retirement acknowledgement finds this detach's own marker. The
        // original bytes were already preserved and registered (onPreserved), so the empty marker
        // must never be backed up in their place.
        let marker = null;
        try { marker = decodeStateFilePayload(raw); } catch { marker = null; }
        if (marker?.retired && marker.retireReason === 'manual-detach' && String(marker.chatKey || '') === key) {
            const recorded = marker.recoveryPath ? { name: String(marker.recoveryName || ''), path: String(marker.recoveryPath) } : {};
            return { alreadyDetached: true, preservedFrom: pointer.path, ...recorded };
        }
        const copyName = makeNpcStateRecoveryFileName(key).replace(/\.json$/i, '-unreadable.json');
        const copy = await uploadPayload({ name: copyName, json: raw, fetchFn, headers });
        const check = await fetchFn(copy.path, { method: 'GET', cache: 'no-store' });
        if (!check?.ok || (typeof check.text === 'function' ? await check.text() : null) !== raw) {
            throw new Error('NPC State could not verify the preserved copy of the broken sidecar; nothing was detached.');
        }
        const preserved = { name: copyName, path: copy.path, preservedFrom: pointer.path };
        // Register the verified backup before the destructive canonical replacement, so a lost
        // acknowledgement of that replacement cannot lose the only reference to the original bytes.
        if (typeof onPreserved === 'function') await onPreserved({ ...preserved });
        const name = pointer.name || makeNpcStateDataFileName(key);
        await uploadPayload({ name, json: encodeRetiredStateFilePayload(key, 'manual-detach', appVersion, { revision: 1, writerId, recoveryPath: copy.path, recoveryName: copyName }), fetchFn, headers });
        return preserved;
    });
}

export async function retireNpcStateDataFile({ chatKey, pointer = null, reason = 'retired', appVersion = '', fetchFn = globalThis.fetch, headers = {} }) {
    if (typeof fetchFn !== 'function') throw new Error('fetch() is unavailable for NPC State data-file persistence.');
    const key = String(chatKey || '');
    cancelPendingNpcStateWrite(key);
    return withWriterLock(key, async () => {
        const name = pointer?.name || makeNpcStateDataFileName(key);
        const expectedRevision = Number.isFinite(Number(pointer?.revision)) ? Math.max(0, Math.trunc(Number(pointer.revision))) : null;
        let current = { revision: expectedRevision ?? 0, exists: false };
        if (pointer?.path) current = await remoteRevision(pointer, key, fetchFn);
        if (expectedRevision === null && current.exists && current.revision > 0) {
            const error = new Error(`NPC State sidecar changed before retirement; this tab has no matching revision token (found revision ${current.revision}).`);
            error.code = 'NPC_STATE_WRITE_CONFLICT';
            error.expectedRevision = null;
            error.actualRevision = current.revision;
            throw error;
        }
        if (expectedRevision !== null && current.exists && current.revision !== expectedRevision) {
            const error = new Error(`NPC State sidecar changed before retirement (expected revision ${expectedRevision}, found ${current.revision}).`);
            error.code = 'NPC_STATE_WRITE_CONFLICT';
            error.expectedRevision = expectedRevision;
            error.actualRevision = current.revision;
            error.expectedWriterId = String(pointer?.writerId || '');
            error.actualWriterId = String(current.writerId || '');
            throw error;
        }
        const expectedWriterId = String(pointer?.writerId || '');
        if (expectedRevision !== null && current.exists && current.revision === expectedRevision
            && expectedWriterId && current.writerId && current.writerId !== expectedWriterId) {
            const error = new Error(`NPC State sidecar revision ${expectedRevision} changed writer before retirement.`);
            error.code = 'NPC_STATE_WRITE_CONFLICT';
            error.expectedRevision = expectedRevision;
            error.actualRevision = current.revision;
            error.expectedWriterId = expectedWriterId;
            error.actualWriterId = String(current.writerId || '');
            throw error;
        }
        const revision = Math.max(current.revision, expectedRevision ?? 0) + 1;
        const json = encodeRetiredStateFilePayload(key, reason, appVersion, { revision, writerId });
        // Only an explicit client-error response proves the retired payload was not written. A lost
        // or unreadable acknowledgement, or a server error, may follow a committed write.
        let result;
        try {
            result = await uploadPayload({ name, json, fetchFn, headers });
        } catch (error) {
            const status = Number(error?.status || 0);
            if (!(status >= 400 && status < 500)) error.retirementUncertain = true;
            throw error;
        }
        // The retired payload may already have replaced the live dossier. Any failure from here on
        // leaves that outcome uncertain, so callers must keep every copy they made.
        let verified;
        try {
            verified = await remoteRevision({ path: result.path }, key, fetchFn);
        } catch (error) {
            error.retirementUncertain = true;
            throw error;
        }
        if (!verified.exists || verified.revision !== revision || (verified.writerId && verified.writerId !== writerId) || !verified.retired) {
            const error = new Error(`NPC State sidecar retirement verification lost ownership at revision ${revision}.`);
            error.code = 'NPC_STATE_WRITE_CONFLICT';
            error.expectedRevision = revision;
            error.actualRevision = verified.exists ? verified.revision : null;
            error.expectedWriterId = writerId;
            error.actualWriterId = String(verified.writerId || '');
            error.retirementUncertain = true;
            throw error;
        }
        return { name, path: result.path, updatedAt: Date.now(), retired: true, revision, writerId };
    });
}
