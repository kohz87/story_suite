// The modules that could not finish a reply, kept per shown swipe (in memory only) for the changes card's "could not finish" row.
// The Problem log is shared and append-only (the Inspector reads it), so a failure is attributed to the swipe shown when it is first seen.

import { isModuleFailure, moduleFailures } from '../../../../../core/turn/apply-report.js';
import { swipeOf } from '../../../../../core/persist.js';

const signOf = item => `${item.index}\n${item.module}\n${item.code}\n${String(item.message ?? '').trim()}`;

/**
 * createReplyFailures({ chat, problems }) → { observe() → [index], at(index, nameOf) → [{ module, name, reason, code }], clearReply(index), forget() }
 * `observe()` reads the Problem log, attributes each failure not seen before to its reply's shown swipe, and says which replies got one.
 */
export function createReplyFailures({ chat, problems }) {
    const byKey = new Map();   // `${index}|${swipe}` → Problems
    const seen = new Map();    // signature → how many of them were already attributed
    const keyOf = index => `${index}|${swipeOf(chat()[index])}`;
    return {
        observe() {
            const counts = new Map();
            const fresh = [];
            for (const item of problems()) {
                if (!isModuleFailure(item) || !Number.isInteger(item.index)) continue;
                const sign = signOf(item);
                const n = (counts.get(sign) ?? 0) + 1;
                counts.set(sign, n);
                if (n > (seen.get(sign) ?? 0)) fresh.push(item);
            }
            seen.clear();
            for (const [sign, n] of counts) seen.set(sign, n);
            const touched = new Set();
            for (const item of fresh) {
                const key = keyOf(item.index);
                byKey.set(key, [...(byKey.get(key) ?? []), item]);
                touched.add(item.index);
            }
            return [...touched];
        },
        at: (index, nameOf) => moduleFailures(byKey.get(keyOf(index)) ?? [], index, nameOf),
        /** A new turn or Re-read on the shown swipe starts afresh. */
        clearReply(index) { byKey.delete(keyOf(index)); },
        forget() { byKey.clear(); },
    };
}
