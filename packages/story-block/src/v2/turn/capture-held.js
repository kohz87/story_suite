// Story Suite v2: the held-module check of a Re-read, moved out of createCaptureFlow unchanged: the first module held back (dormant, or a restore in
// progress) that the reply carries lines, receipts or ops of.
import { readRecord } from '../persist.js';
import { heldWhy } from '../assist/safety.js';

/**
 * Re-read (F40): reads reply `index`'s <Changes> block again, as its shown swipe has it now, and
 * replaces the story changes stored on it the way a fresh capture would (store.replaceStory): its
 * `story` receipts go, the lines run again on the state before the reply, and the reader's own
 * actions and system steps on it stay after them (their claims too). Later replies are checked
 * again on top; if one of them no longer fits, nothing changes. Refused for the reader's messages,
 * system messages, messages that hold no story record, and while a reply is being written.
 * Saves once and emits `turn` ({ index, type: 'reread', receipts, problems, told: [] }).
 * → { ok: true, receipts, problems } | { ok: false, code, message }.
 */
// The first module held back (registry.heldModules) that the reply carries lines, receipts or ops of, as
// { code, name, reason }, else null. `lines`: the change lines about to be read again.
export function heldInReply(registry, message, lines, assist = []) {
    const held = new Set(registry.heldModules?.() ?? []);
    if (!held.size) return null;
    const record = readRecord(message);
    const found = new Set(assist.map(line => heldWhy(registry, line)?.module).filter(Boolean));   // (the safety net's lines, refused live under the same rule)
    for (const line of lines) {
        const owner = registry.captureOwner?.(line?.kind);
        if (owner) found.add(owner);
    }
    for (const receipt of record?.receipts ?? []) if (typeof receipt?.module === 'string') found.add(receipt.module);
    for (const op of record?.ops ?? []) {
        const owner = typeof op?.path === 'string' ? registry.domainOwner?.(/^\/domains\/([^/]+)/.exec(op.path)?.[1] ?? '') : null;
        if (owner) found.add(owner);
    }
    const id = [...held].sort().find(item => found.has(item));
    if (!id) return null;
    const life = registry.lifecycle?.(id);
    return { code: life?.status === 'restore-pending' ? 'RESTORE_PENDING' : 'DEPENDENCY_UNAVAILABLE', name: registry.module?.(id)?.name ?? id, reason: life?.reason ?? 'It is not running.' };
}
