// World events on the host: learned secrets as anchors (switch story-director.world-events; spec v0.14.4 §3, ruling 32). After a reply's
// lines (and after its daily step, so the anchor holds only from the next message or day on), each pack secret NPC State has opened —
// a note in a dossier made from the pack (`castFrom.id`) whose id is in the person's `unlocked` list, matched to the pack secret by its
// id or its text — is recorded in the ledger as `learned:<cast id>/<secret id>` on today, with `fact:<writes_fact>` when the secret
// writes one (the first secret to write a fact writes it; later ones change nothing). The ledger is a slot on the reply, so a swipe,
// a delete, an edit or a rewind of the reveal takes it back. `learned:lore/<entry id>` has no source yet (nothing learns lore).

import { slotValue } from '../../../rpg/slot.js';
import { ledgerOf, markLedger } from '../conditions/ledger.js';
import { clockOf } from '../capture/text.js';
import { worldEventsOn } from '../capture/world-parts/switch.js';
import { WORLD_EVENTS_FEATURE } from '../conditions/feature.js';
import { readWorld } from './read-world.js';

export const LEARNED = 'chronicle.world.learned';
const DAY = 1440;
const flat = text => String(text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * The anchors NPC State's opened notes make that are not recorded yet: `["learned:<cast id>/<secret id>", "fact:<id>", …]`.
 * `people` the people domain ({ npcs, bonds: { npcs } }); `cast` the world's cast entries; `known` the anchors already recorded.
 */
export function learnedAnchors(people, cast, known = new Set()) {
    const dossiers = isRecord(people?.npcs) ? people.npcs : {};
    const bonds = isRecord(people?.bonds?.npcs) ? people.bonds.npcs : {};
    const out = [];
    const facts = new Set([...known].filter(key => key.startsWith('fact:')));
    for (const id of Object.keys(dossiers).sort()) {
        const dossier = dossiers[id];
        const entry = (Array.isArray(cast) ? cast : []).find(person => person?.id === dossier?.castFrom?.id);
        const opened = new Set(Array.isArray(bonds[id]?.unlocked) ? bonds[id].unlocked : []);
        if (!entry || !opened.size) continue;
        const notes = (Array.isArray(dossier.secrets) ? dossier.secrets : []).filter(note => opened.has(note?.id));
        for (const secret of Array.isArray(entry.secrets) ? entry.secrets : []) {
            if (typeof secret?.id !== 'string' || !notes.some(note => note.id === secret.id || flat(note.text) === flat(secret.text))) continue;
            const key = `learned:${entry.id}/${secret.id}`;
            if (known.has(key)) continue;
            out.push(key);
            const fact = typeof secret.writes_fact === 'string' ? `fact:${secret.writes_fact}` : null;
            if (fact && !facts.has(fact)) { facts.add(fact); out.push(fact); }
        }
    }
    return out;
}

/** The anchors recorded so far: the daily step's own and the ledger's. */
export function knownAnchors(chronicle) {
    return new Set([...Object.keys(slotValue(chronicle?.daily)?.anchors ?? {}), ...Object.keys(ledgerOf(chronicle?.ledger).anchors)]);
}

function learned(ctx) {
    if (ctx.cause !== 'system' || ctx.caller) return ctx.fail('REFUSED', 'Learned secrets are recorded only by code after a reply.');
    if (!worldEventsOn(ctx)) return ctx.fail('REFUSED', 'World events are off.');
    const now = clockOf(ctx);
    if (now === null) return { summary: '', narrate: false, data: { anchors: [] } };
    const chronicle = ctx.draft('chronicle');
    let people = null;
    try { people = ctx.read('people'); } catch { people = null; }
    const anchors = learnedAnchors(people, readWorld((name, args) => ctx.query(name, args)).cast, knownAnchors(chronicle));
    if (!anchors.length) return { summary: '', narrate: false, data: { anchors: [] } };
    markLedger(chronicle, { day: Math.floor(now / DAY), anchors });
    const facts = anchors.filter(key => key.startsWith('fact:')).map(key => key.slice(5));
    return { summary: `World: a secret came out${facts.length ? ` (fact ${facts.join(', ')} written)` : ''}.`, narrate: false, data: { anchors } };
}

/** The command, tagged with the feature and internal (never from a click or the sdk). */
export const learnedCommand = Object.assign(learned, { feature: WORLD_EVENTS_FEATURE });
Object.defineProperty(learnedCommand, 'internal', { value: true, enumerable: true });
