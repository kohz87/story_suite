// World events on the host: hidden lore that opens (switch story-director.world-events; spec §7, LF4-5). After a reply's lines, a hidden
// entry whose gate holds and that no reply has opened yet is recorded in the ledger as `opened:lore/<key>` (a slot on that reply: a swipe,
// a delete, an edited Re-read or a rewind of the reply takes it back until a later reply's daily step has taken it into its own anchors;
// then it stays, as a learned secret does), so a `place:` gate stays open after You leave the place. Before each reply the open entries
// (lore-gate.js) go to the narrator as the world tail's last optional lines, small and capped; a closed one is in no prompt.
// Opening an entry is not learning it: `learned:lore/<id>` and the entry's `writes_fact` have no source yet.

import { markLedger } from '../conditions/ledger.js';
import { clockOf } from '../capture/text.js';
import { worldEventsOn } from '../capture/world-parts/switch.js';
import { WORLD_EVENTS_FEATURE } from '../conditions/feature.js';
import { scenePlaceOf } from '../pick-parts/nearness.js';
import { readWorld } from './read-world.js';
import { knownAnchors } from './learned.js';
import { unheldFacts } from './holding-facts.js';
import { OPENED, loreKey, openLore } from './lore-gate.js';

export const LORE_OPEN = 'chronicle.world.loreOpen';
const DAY = 1440;
const MAX_ENTRIES = 2;
const ENTRY_CHARS = 600;
const TOTAL_CHARS = 1000;
const LABEL = 'Lore (now open)';
const flat = text => String(text ?? '').replace(/\s+/g, ' ').trim();
const clip = (text, room) => (text.length <= room ? text : `${text.slice(0, Math.max(0, room - 1)).replace(/\s+\S*$/, '')}…`);

// The entries open now and the keys no reply has recorded yet, from a query and the chronicle and scene as stored.
function readOpen(query, chronicle, scene) {
    const world = readWorld(query);
    const anchors = knownAnchors(chronicle, unheldFacts(query));
    const open = openLore(world.lore, { anchors, place: scenePlaceOf(query, { domains: { scene } }), places: world.places });
    return { open, fresh: open.map(loreKey).filter(key => key && !anchors.has(`${OPENED}${key}`)) };
}

const queryOf = source => (typeof source?.query === 'function' ? (name, args) => source.query(name, args) : () => null);

/** For the afterCapture hook: whether the reply opened a hidden entry not recorded yet (read from the reply's state after its lines). */
export function loreOpenDue(view) {
    const domains = view?.state?.domains;
    if (!worldEventsOn(view) || !domains?.chronicle) return false;
    return readOpen(queryOf(view), domains.chronicle, domains.scene).fresh.length > 0;
}

/** The narrator's lines for the open entries (none while the switch is off): at most 2, each about 150 tokens, those the reader's message or the place names first. */
export function openLoreLines(view) {
    const domains = view?.state?.domains;
    if (!worldEventsOn(view) || !domains?.chronicle) return [];
    const query = queryOf(view);
    const { open } = readOpen(query, domains.chronicle, domains.scene);
    if (!open.length) return [];
    const said = `${view?.chat?.lastUser ?? ''} ${scenePlaceOf(query, view.state)}`.toLowerCase();
    const named = entry => (Array.isArray(entry.keys) ? entry.keys : []).some(key => typeof key === 'string' && key.trim() && said.includes(key.trim().toLowerCase()));
    const ordered = [...open.filter(named), ...open.filter(entry => !named(entry))].slice(0, MAX_ENTRIES);
    const out = [];
    let used = 0;
    for (const entry of ordered) {
        const head = `${LABEL} — ${flat(entry.title)}: `;
        const room = Math.min(ENTRY_CHARS, TOTAL_CHARS - used) - head.length;
        if (room < 80) break;
        const line = `${head}${clip(flat(entry.text), room)}`;
        out.push(line);
        used += line.length;
    }
    return out;
}

function loreOpen(ctx) {
    if (ctx.cause !== 'system' || ctx.caller) return ctx.fail('REFUSED', 'Hidden lore is opened only by code after a reply.');
    if (!worldEventsOn(ctx)) return ctx.fail('REFUSED', 'World events are off.');
    const now = clockOf(ctx);
    const none = { summary: '', narrate: false, data: { opened: [] } };
    if (now === null) return none;
    const chronicle = ctx.draft('chronicle');
    let scene = null;
    try { scene = ctx.read('scene'); } catch { scene = null; }
    const { fresh } = readOpen(queryOf(ctx), chronicle, scene);
    if (!fresh.length) return none;
    markLedger(chronicle, { day: Math.floor(now / DAY), anchors: fresh.map(key => `${OPENED}${key}`) });
    return { summary: 'World: hidden lore opened.', narrate: false, data: { opened: fresh } };
}

/** The command, tagged with the feature and internal (never from a click or the sdk). */
export const loreOpenCommand = Object.assign(loreOpen, { feature: WORLD_EVENTS_FEATURE });
Object.defineProperty(loreOpenCommand, 'internal', { value: true, enumerable: true });
