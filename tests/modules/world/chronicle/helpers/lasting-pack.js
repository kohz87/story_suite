// A format 4 world pack for the delete fuzzes (tests/suite/break/director/fuzz-delete*.test.js): it carries world events (a levy set in
// motion on day 2, an omen rolled over twenty days, a later feast) that the daily step runs with the switch on, setting and fading
// conditions as days cross. The fuzz's world lines and the reader's edits name entries of their own (`+ world Fuzz omen`), so a skipped block
// can only come from bookkeeping one reply keeps for another. (Dated pack events that wrote `chronicle.lasting` through `then` are gone with format 3.)

import { cleanName } from '../../../../../modules/world/chronicle/domain.js';

/** The entries the story's lines and the reader's edits may name. */
export const LASTING_NAMES = Object.freeze(['Fuzz omen', 'Fuzz any']);

export const LASTING_PACK = JSON.stringify({
    id: 'fuzz-lasting',
    format: 4,
    kind: 'world',
    version: '1.0.0',
    name: 'Fuzz lasting',
    requires: { suite: '^0.1' },
    content: {
        placeKinds: { town: 'town' },
        realms: [{ id: 'march-realm', name: 'March Realm', regions: ['the-march'] }],
        places: [{ id: 'highmark', name: 'Highmark', region: 'the-march', x: 0, y: 0, kind: 'town' }, { id: 'bluewatch', name: 'Bluewatch', region: 'the-march', x: 5, y: 5, kind: 'town' }],
        conditions: [
            { name: 'unrest', scope: 'place', fades: '10 days', means: 'Crowds in the streets.' },
            { name: 'grain-dear', scope: 'region', fades: '2 days', means: 'Bread costs more.' },
        ],
        worldEvents: [
            { id: 'levy', kind: 'one-off', certainty: 'set-in-motion', where: ['Highmark'], window: { after: 'start', within: '2 days' }, ends_when: { for: '3 days' }, effects: { set: ['unrest@Highmark'] }, summary: 'The lord calls a levy.' },
            { id: 'omen', kind: 'one-off', certainty: 'possible', chance: '60% over the window', where: ['Bluewatch'], window: { after: 'start', within: '20 days' }, ends_when: 'instant', effects: { set: ['grain-dear@the-march: 5 days'] }, outcomes: [{ name: 'bright', weight: 1 }, { name: 'dark', weight: 1 }], summary: 'An omen over Bluewatch: {outcome}.' },
        ],
    },
});

/**
 * Lines of the story that name the pack's entries, from a random stream of their own (so the fuzz's other
 * stories stay as they were): `+ world` adds to a locked entry or makes one the event then takes over.
 */
export function lastingLines(r) {
    const lines = [];
    if (r.chance(0.25)) lines.push(`+ world ${r.pick(LASTING_NAMES)} — ${r.pick(['word came', 'a rumour', 'it spreads'])} | state: ${r.pick(['looming', 'ongoing', 'resolved'])}`);
    return lines;
}

/** The reader's edit of a pack entry now and then (cause `ui`): a summary, the keep flag or the lock. Returns the command or null. */
export function lastingEdit(r, host, n) {
    if (!r.chance(0.2)) return null;
    const entry = host.sdk.query('chronicle.event', { name: r.pick(LASTING_NAMES) });
    if (!entry) return null;
    const roll = r();
    const change = roll < 0.5 ? { summary: cleanName(`Edited in reply ${n}`) } : roll < 0.8 ? { keep: entry.keep !== true } : { locked: false };
    return { id: entry.id, ...change };
}
