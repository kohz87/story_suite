// The sidecar write: one guarded, verified write per chat at a time, queued for durability and retried until it lands or is cancelled.

import { uploadPayload } from './storage-files.js';
import { withWriterLock } from './storage-locks.js';
import { probeNpcStateDataFilePointer, remoteRevision } from './storage-inspect.js';
import { writerId } from './storage-self.js';
import { makeNpcStateDataFileName } from './storage-names.js';
import { encodeStateFilePayload } from './storage-encode.js';
import { rememberUndurableSnapshot, undurableSnapshots } from './storage-undurable.js';
import { NPC_STATE_DURABILITY_RETRY_CAP_MS, NPC_STATE_WRITE_RETRY_DELAYS_MS, retryableWriteError, wait } from './storage-retry.js';

export const durabilityQueue = new Map();

async function guardedWriteOnce(job) {
    const { chatKey, state, appVersion, pointer, fetchFn, headers, assertCurrent = () => {} } = job;
    return withWriterLock(chatKey, async () => {
        assertCurrent();
        const expectedRevision = Number.isFinite(Number(pointer?.revision)) ? Math.max(0, Math.trunc(Number(pointer.revision))) : null;
        const probedDeterministicPath = !pointer?.path;
        // A write with no pointer is a chat's first (the deterministic path is probed): the file is usually not there yet, so
        // it is asked about first (probeHeaders) and a chat's first save makes no 404 request. Pointered writes read it as before.
        const probeHeaders = probedDeterministicPath && headers && Object.keys(headers).length ? headers : null;
        const current = await remoteRevision(probeNpcStateDataFilePointer(chatKey, pointer), chatKey, fetchFn, probeHeaders);
        // The previous attempt of this same job may have become durable although its response or
        // post-upload verification was lost. Only the exact revision/writer/timestamp nonce of that
        // upload proves ownership; the job's state is immutable, so adopting it is byte-equivalent.
        const lost = job.lastUpload;
        if (lost && current.exists && current.revision === lost.revision
            && current.writerId === writerId && current.updatedAtText === lost.updatedAt) {
            return { name: lost.name, path: lost.path || pointer?.path || probeNpcStateDataFilePointer(chatKey, pointer).path, updatedAt: Date.now(), revision: lost.revision, writerId };
        }
        // An unpointered writer may replace a retired tombstone (for example a reused chat name), but
        // never a live canonical sidecar that another session created after this one hydrated.
        if (expectedRevision === null && current.exists && current.revision > 0 && !(probedDeterministicPath && current.retired)) {
            const error = new Error(`NPC State sidecar already has revision ${current.revision}, but this tab has no matching revision token. Reload the chat before saving again.`);
            error.code = 'NPC_STATE_WRITE_CONFLICT';
            error.expectedRevision = null;
            error.actualRevision = current.revision;
            throw error;
        }
        if (expectedRevision !== null && current.exists && current.revision !== expectedRevision) {
            const error = new Error(`NPC State sidecar changed in another tab or writer (expected revision ${expectedRevision}, found ${current.revision}). Reload the chat before saving again.`);
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
            const error = new Error(`NPC State sidecar revision ${expectedRevision} belongs to a different writer than this working copy. Reload the chat before saving again.`);
            error.code = 'NPC_STATE_WRITE_CONFLICT';
            error.expectedRevision = expectedRevision;
            error.actualRevision = current.revision;
            error.expectedWriterId = expectedWriterId;
            error.actualWriterId = String(current.writerId || '');
            throw error;
        }
        const revision = Math.max(current.revision, expectedRevision ?? 0) + 1;
        const name = pointer?.name || makeNpcStateDataFileName(chatKey);
        const updatedAt = new Date().toISOString();
        const json = encodeStateFilePayload(chatKey, state, appVersion, { revision, writerId, updatedAt });
        assertCurrent();
        job.lastUpload = { name, path: '', revision, updatedAt };
        const result = await uploadPayload({ name, json, fetchFn, headers });
        job.lastUpload.path = String(result.path || '');
        // The read-back still asks the server; when it returns exactly the bytes just uploaded, their revision
        // and writer are the ones written, and the next boundary check finds this file by its ETag (1.10.1).
        const written = { text: json, meta: { chatKey: String(chatKey || ''), revision, writerId, retired: false, updatedAtText: updatedAt } };
        const verified = await remoteRevision({ path: result.path }, chatKey, fetchFn, null, written);
        if (!verified.exists || verified.revision !== revision || (verified.writerId && verified.writerId !== writerId)) {
            const error = new Error(`NPC State sidecar write verification lost ownership at revision ${revision}; another session wrote the canonical file concurrently.`);
            error.code = 'NPC_STATE_WRITE_CONFLICT';
            error.expectedRevision = revision;
            error.actualRevision = verified.exists ? verified.revision : null;
            error.expectedWriterId = writerId;
            error.actualWriterId = String(verified.writerId || '');
            throw error;
        }
        return { name, path: result.path, updatedAt: Date.now(), revision, writerId };
    });
}

export function cancelPendingNpcStateWrite(chatKey) {
    const key = String(chatKey || '');
    const job = durabilityQueue.get(key);
    if (job) job.cancelled = true;
    const removedQueued = durabilityQueue.delete(key);
    const removedShadow = undurableSnapshots.delete(key);
    return removedQueued || removedShadow;
}

export function pendingNpcStateDurabilityKeys() {
    return [...new Set([...durabilityQueue.keys(), ...undurableSnapshots.keys()])];
}

export async function writeNpcStateDataFile({ chatKey, state, appVersion = '', pointer = null, operationKey = '', fetchFn = globalThis.fetch, headers = {}, sleepFn = globalThis.setTimeout, continuousRetry = true, recoveryState = () => state, isCurrent = () => true }) {
    const key = String(chatKey || '');
    const durabilityKey = String(operationKey || key);
    if (durabilityQueue.has(durabilityKey)) {
        const error = new Error(`NPC State already has a durability retry in progress for ${durabilityKey}.`);
        error.code = 'NPC_STATE_WRITE_IN_PROGRESS';
        throw error;
    }
    const job = {
        chatKey: key, durabilityKey, state, appVersion, pointer, fetchFn, headers,
        cancelled: false, attempt: 0, lastError: null, recoveryState,
        assertCurrent() {
            if (!job.cancelled && isCurrent()) return;
            const error = new Error(`NPC State durability retry for ${key} was cancelled.`);
            error.code = 'NPC_STATE_WRITE_CANCELLED';
            throw error;
        },
    };
    // Track cancellation from the first attempt, including failures while acquiring the lock
    // or checking the remote revision. Every terminal failure shares one recovery exit.
    durabilityQueue.set(durabilityKey, job);
    try {
        if (typeof fetchFn !== 'function') throw new Error('fetch() is unavailable for NPC State data-file persistence.');
        const retryDelays = continuousRetry ? NPC_STATE_WRITE_RETRY_DELAYS_MS : [0, 250, 750, 1500];
        for (const delay of retryDelays) {
            if (delay) await wait(delay, sleepFn);
            job.assertCurrent();
            try {
                const written = await guardedWriteOnce(job);
                job.assertCurrent();
                undurableSnapshots.delete(key);
                return written;
            } catch (error) {
                job.lastError = error;
                if (!retryableWriteError(error)) throw error;
            }
        }
        if (!continuousRetry) throw job.lastError || new Error(`NPC State bounded sidecar write failed for ${key}.`);
        console.warn(`[NPC State] sidecar write for ${key} is still dirty after bounded retries; retaining the active write lock and retrying every ${NPC_STATE_DURABILITY_RETRY_CAP_MS / 1000}s until it is durable.`);
        while (true) {
            await wait(NPC_STATE_DURABILITY_RETRY_CAP_MS, sleepFn);
            job.assertCurrent();
            try {
                const written = await guardedWriteOnce(job);
                job.assertCurrent();
                undurableSnapshots.delete(key);
                if (pointer && typeof pointer === 'object') Object.assign(pointer, written);
                console.info(`[NPC State] recovered a previously failed sidecar write for ${key} at revision ${written.revision}.`);
                return written;
            } catch (error) {
                job.lastError = error;
                job.attempt += 1;
                if (!retryableWriteError(error)) throw error;
            }
        }
    } catch (error) {
        if (continuousRetry && !job.cancelled && isCurrent()) {
            rememberUndurableSnapshot({ chatKey: key, state: recoveryState(), appVersion, pointer, error });
        }
        throw error;
    } finally {
        if (durabilityQueue.get(durabilityKey) === job) durabilityQueue.delete(durabilityKey);
    }
}
