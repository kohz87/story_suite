// The per-connection queue: calls on one connection run one at a time, in order.

import { CHAT_PROFILE } from './shared-consts.js';
import { now } from './shared-helpers.js';

class QueueLeft extends Error {
    constructor() {
        super('The call left the queue before its turn.');
        this.code = 'QUEUE_LEFT';
    }
}

/**
 * The per-connection queue. `deps`: { enabled() → bool (the host's `callQueue` setting; default on),
 * clock() → ms (for the waits' report only, never state) }. Returns { run(key, fn, { signal }) → fn()'s
 * result, stats() → { on, waiting, running, waited, waitedMs, longestMs, lanes: { [key]: waiting } } }.
 * `key` is the profile's stored name ('' the chat's). A call waits while another of its key runs; one
 * whose `signal` aborts while it waits leaves the queue and rejects (code QUEUE_LEFT) without running.
 * A running call frees its key when it settles or when its signal aborts (a timed-out chat call cannot be
 * stopped; the next one does not wait for its late answer).
 */
export function createCallQueue({ enabled = () => true, clock = now } = {}) {
    const lanes = new Map();
    let waited = 0;
    let waitedMs = 0;
    let longestMs = 0;
    const lane = key => {
        let found = lanes.get(key);
        if (!found) {
            found = { running: false, waiting: [] };
            lanes.set(key, found);
        }
        return found;
    };
    const isOn = () => {
        try { return enabled() !== false; } catch { return true; }
    };
    function next(key) {
        const item = lanes.get(key);
        if (!item || item.running) return;
        const first = item.waiting.shift();
        if (!first) {
            lanes.delete(key);
            return;
        }
        item.running = true;
        first.start();
    }
    async function run(key, fn, { signal = null } = {}) {
        if (!isOn()) return fn();
        const name = String(key ?? '');
        const item = lane(name);
        if (signal?.aborted) throw new QueueLeft();
        if (item.running || item.waiting.length) {
            const asked = clock();
            await new Promise((resolve, reject) => {
                const entry = {
                    start: () => {
                        signal?.removeEventListener?.('abort', leave);
                        const ms = Math.max(0, clock() - asked);
                        waited += 1;
                        waitedMs += ms;
                        longestMs = Math.max(longestMs, ms);
                        resolve();
                    },
                };
                const leave = () => {
                    const at = item.waiting.indexOf(entry);
                    if (at >= 0) item.waiting.splice(at, 1);
                    reject(new QueueLeft());
                };
                signal?.addEventListener?.('abort', leave, { once: true });
                item.waiting.push(entry);
                next(name);
            });
        } else item.running = true;
        let freed = false;
        const free = () => {
            if (freed) return;
            freed = true;
            signal?.removeEventListener?.('abort', free);
            item.running = false;
            next(name);
        };
        signal?.addEventListener?.('abort', free, { once: true });
        try {
            return await fn();
        } finally {
            free();
        }
    }
    function stats() {
        let waiting = 0;
        let running = 0;
        const byLane = {};
        for (const [key, item] of lanes) {
            waiting += item.waiting.length;
            if (item.running) running += 1;
            if (item.waiting.length) byLane[key || CHAT_PROFILE] = item.waiting.length;
        }
        return { on: isOn(), waiting, running, waited, waitedMs: Math.round(waitedMs), longestMs: Math.round(longestMs), lanes: byLane };
    }
    return { run, stats };
}
