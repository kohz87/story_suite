// Story Director v2, part **arc**: reading the Director judge's answer (strict lines; anything else is left unread). Pure.

import { THINK_BLOCK, flat } from '../plan/shared.js';

const NOTE_POINTS = 480;
const ITEM = /^\s*(?:item\s*)?(\d{1,2})\s*[:.)]\s*(accept|reshape|refuse)\b\s*[:\-–—]?\s*(.*)$/i;
const NOTE = /^\s*note\s*:\s*(.+)$/i;

/**
 * `{ items: { [n]: { verdict: 'accept' | 'reshape' | 'refuse', rest } }, note }` from the answer's text, or null when it holds no verdict line. The first line for an
 * item counts; `note` is the NOTE line cut to about 120 tokens, markup and line breaks taken out ('' when there is none).
 */
export function readJudge(text) {
    const items = {};
    let note = '';
    for (const raw of String(text ?? '').slice(0, 8000).replace(THINK_BLOCK, '').split(/\r?\n/)) {
        const line = raw.replace(/\*\*|__/g, '');
        const verdict = ITEM.exec(line);
        if (verdict) {
            const n = Number(verdict[1]);
            if (!Object.hasOwn(items, n)) items[n] = { verdict: verdict[2].toLowerCase(), rest: verdict[3].trim() };
            continue;
        }
        const noted = !note && NOTE.exec(line);
        if (noted) note = flat(noted[1], NOTE_POINTS);
    }
    return Object.keys(items).length ? { items, note } : null;
}
