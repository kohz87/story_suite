// Story Director v2, names: the feature flag, the part's settings and the pack's names lists.

import { DEFAULT_SUGGESTIONS } from './limits.js';
import { parseBanned, clampCount } from './clamp-banned.js';
import { isRecord, ask } from './host-read.js';

export const FEATURE = 'story-director.names';

export const settingsOf = source => {
    let values = null;
    try { values = typeof source?.settings === 'function' ? source.settings() : null; } catch { values = null; }
    return { banned: parseBanned(isRecord(values) ? values.banned : ''), count: clampCount(isRecord(values) && values.suggestions !== undefined ? values.suggestions : DEFAULT_SUGGESTIONS) };
};

/** Whether the feature is on (`source.feature` when the host has it); unlike the older parts it is off when the host cannot say. */
export function namesOn(source) {
    try { return typeof source?.feature === 'function' && source.feature(FEATURE) === true; } catch { return false; }
}

/** The pack's `names` lists (`packs.content { kind: 'names' }`): the entries' cultures joined, their banned lists joined; null when none. */
export function packNames(query) {
    const out = { banned: [] };
    for (const item of [].concat(ask(query, 'packs.content', { kind: 'names' }) ?? [])) {
        const names = isRecord(item?.names) ? item.names : item;
        if (!isRecord(names)) continue;
        for (const [key, value] of Object.entries(names)) {
            if (key === 'banned' && Array.isArray(value)) out.banned.push(...value);
            else if (key !== 'banned' && isRecord(value) && !Object.hasOwn(out, key)) out[key] = value;
        }
    }
    return Object.keys(out).length > 1 || out.banned.length ? out : null;
}
