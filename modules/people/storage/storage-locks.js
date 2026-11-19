// One writer per chat sidecar: an in-page queue, then Web Locks when the browser has them, else a cross-tab lease in localStorage.

import { fnv1a } from './storage-names.js';
import { writerId } from './storage-self.js';
import { wait } from './storage-retry.js';

const writerLocks = new Map();

const CROSS_TAB_LOCK_LEASE_MS = 15_000;

const CROSS_TAB_LOCK_ACQUIRE_MS = 5_000;

async function withInProcessWriterLock(chatKey, task) {
    const key = String(chatKey || '');
    const previous = writerLocks.get(key) || Promise.resolve();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    const queued = previous.catch(() => {}).then(() => gate);
    writerLocks.set(key, queued);
    await previous.catch(() => {});
    try { return await task(); }
    finally {
        release();
        if (writerLocks.get(key) === queued) writerLocks.delete(key);
    }
}

function localStorageLockRecord(storage, key) {
    try {
        const value = JSON.parse(String(storage.getItem(key) || 'null'));
        if (!value || typeof value !== 'object') return null;
        return { token: String(value.token || ''), expiresAt: Number(value.expiresAt || 0) };
    } catch { return null; }
}

async function withLocalStorageWriterLock(chatKey, task) {
    const storage = globalThis.localStorage;
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function' || typeof storage.removeItem !== 'function') {
        return withInProcessWriterLock(chatKey, task);
    }
    const key = `npc-state-delta-writer-lock:${fnv1a(String(chatKey || ''))}`;
    const token = `${writerId}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
    const deadline = Date.now() + CROSS_TAB_LOCK_ACQUIRE_MS;
    while (Date.now() <= deadline) {
        const now = Date.now();
        const current = localStorageLockRecord(storage, key);
        if (!current || !current.token || current.expiresAt <= now) {
            try { storage.setItem(key, JSON.stringify({ token, expiresAt: now + CROSS_TAB_LOCK_LEASE_MS })); }
            catch { return withInProcessWriterLock(chatKey, task); }
            await wait(12 + Math.floor(Math.random() * 18));
            const confirmed = localStorageLockRecord(storage, key);
            if (confirmed?.token === token) {
                const renew = globalThis.setInterval?.(() => {
                    try {
                        const owned = localStorageLockRecord(storage, key);
                        if (owned?.token === token) storage.setItem(key, JSON.stringify({ token, expiresAt: Date.now() + CROSS_TAB_LOCK_LEASE_MS }));
                    } catch { /* lease expiry remains the safety fallback */ }
                }, Math.max(1000, Math.floor(CROSS_TAB_LOCK_LEASE_MS / 3)));
                try { return await withInProcessWriterLock(chatKey, task); }
                finally {
                    if (renew) globalThis.clearInterval?.(renew);
                    try { if (localStorageLockRecord(storage, key)?.token === token) storage.removeItem(key); } catch { /* lease expires */ }
                }
            }
        }
        await wait(18 + Math.floor(Math.random() * 24));
    }
    const error = new Error(`NPC State could not acquire the cross-tab sidecar lock for ${chatKey}.`);
    error.code = 'NPC_STATE_LOCK_TIMEOUT';
    throw error;
}

export async function withWriterLock(chatKey, task) {
    const name = `npc-state-delta-sidecar:${fnv1a(String(chatKey || ''))}`;
    const locks = globalThis.navigator?.locks;
    if (locks && typeof locks.request === 'function') {
        return locks.request(name, { mode: 'exclusive' }, () => withInProcessWriterLock(chatKey, task));
    }
    return withLocalStorageWriterLock(chatKey, task);
}
