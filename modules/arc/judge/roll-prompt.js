// Story Director v2, part **arc**: the Director judge's prompt and reader for tomorrow's daily roll (model-facing, switch story-director.world-events;
// the chronicle setting `judge` asks about the events the roll will fire, the arc setting `dailyPass` about every eligible one; new wording, for the
// owner's approval: WORLDEV2.REPORT.md). Code keeps the roll: the judge may only hold an event back (a cited reason) or, in the daily pass, make it
// likelier or less likely for the day. Pure.

import { THINK_BLOCK, flat } from '../plan/shared.js';

const BASE = [
    'The world is about to roll its events for tomorrow. Each numbered item is one event that may happen there: its title, what happens and where. Judge each against the world below.',
    'Refuse an item that contradicts the lore or the story so far, decides how an Active world event ends, or kills, moves or changes a protected person; give the reason, naming the lore entry, condition or event it breaks. Accept every other item. When unsure, accept.',
];
const PASS = 'You may also mark an item likelier or less likely when the world as it stands favours it or works against it.';
const ANSWER = ['Answer with one line per item and nothing else:', '<n>: accept', '<n>: refuse: <the reason, under 20 words>'];

/** The system text: `pass` (the daily pass) adds likelier / less likely. */
export const rollSystem = pass => [...BASE, ...(pass ? [PASS] : []), ...ANSWER, ...(pass ? ['<n>: likelier', '<n>: less likely'] : []), 'A reason never names, quotes or hints at hidden lore or a secret not yet learned.'].join('\n');

/** The prompt: the world text, then the items ("Title — what happens | place: X"). */
export function rollPrompt({ world = '', items = [] } = {}) {
    const line = item => `${flat(item.title, 80)}${item.summary ? ` — ${flat(item.summary, 240)}` : ''}${item.place ? ` | place: ${flat(item.place, 80)}` : ''}`;
    return [world, 'Items:', ...items.map((item, index) => `${index + 1}: ${line(item)}`)].filter(Boolean).join('\n');
}

const ITEM = /^\s*(?:item\s*)?(\d{1,2})\s*[:.)]\s*(accept|likelier|less likely|refuse)\b\s*[:\-–—]?\s*(.*)$/i;

/** `{ [n]: { verdict: 'accept' | 'likelier' | 'less' | 'refuse', rest } }` (the first line for an item counts), or null when no line reads. */
export function readRoll(text) {
    const items = {};
    for (const raw of String(text ?? '').slice(0, 6000).replace(THINK_BLOCK, '').split(/\r?\n/)) {
        const found = ITEM.exec(raw.replace(/\*\*|__/g, ''));
        if (!found || Object.hasOwn(items, Number(found[1]))) continue;
        const word = found[2].toLowerCase();
        items[Number(found[1])] = { verdict: word === 'less likely' ? 'less' : word, rest: found[3].trim() };
    }
    return Object.keys(items).length ? items : null;
}
