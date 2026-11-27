// World events, the daily step: the world a pack begins in (`start.world`, spec ruling 43), applied once on a chat's first step. Its conditions are set
// (with the duration written, else the condition's own fade) and its facts written as if they had been written on the first day; no news, no Journal
// line, no cap, density or event: it only makes what already holds true. A place status here evacuates nobody. Pure (on `ws`).

import { conditionString } from './grammar.js';
import { scaledDays } from './durations.js';
import { setCondition } from './holds.js';
import { recordAnchor } from './anchors.js';

const DAY = 1440;
const list = value => (Array.isArray(value) ? value : []);
// A note about the pack's own start entry quotes it: Problems only.
const unread = (ws, text) => { ws.warnings.push(text); (ws.card ??= {})[text] = ''; };

/** Apply `start` = `{ set: ["<condition>@<ref>[: <duration>]"], facts: ["<fact id>"] }` on `day`. */
export function applyStartWorld(ws, start, day) {
    for (const text of list(start?.set)) {
        const parsed = conditionString(text);
        const declared = parsed ? ws.declared.get(parsed.name) : null;
        if (!parsed || !declared || parsed.placeholder) { unread(ws, `start.world: "${text}" could not be read as one of this world's conditions.`); continue; }
        const days = scaledDays(parsed.duration ?? declared.fades ?? 'until cleared', ws.tempo, { open: true });
        if (days === undefined) { unread(ws, `start.world: "${text}" has a duration that cannot be read.`); continue; }
        setCondition(ws, { name: parsed.name, ref: parsed.ref, days, holder: null, by: 'code', why: 'the story begins so' }, day * DAY);
    }
    for (const id of list(start?.facts)) {
        if (typeof id !== 'string' || ws.facts[id]) continue;
        ws.facts[id] = { text: '', day };
        recordAnchor(ws.anchors, `fact:${id}`, day);
    }
}
