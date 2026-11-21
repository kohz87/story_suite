// The encounters' two commands: the roll for the reply being written (a prelude, stored with the reply) and the promotion of a backdrop
// person the story named (after the reply's lines). Both are code's own steps (cause system), refused from a click.

import { toSlot } from '../../../rpg/slot.js';
import { fightOn } from '../../../cast/cast/entries.js';
import { dayOf, slotOf, timeOfDay } from '../../../cast/cast/domain.js';
import { isWorldSeed } from '../../chronicle/world-daily/seed.js';
import { resultsOf } from '../../pulse/effects.js';
import { encounterTable } from './table.js';
import { rollEncounter, sceneKey } from './roll.js';
import { encounterLine } from './line.js';
import { ledgerOf, withBinding, withResult } from './ledger.js';
import { hereOf } from './reads.js';

// A chat with no World events seed rolls from this one (still the same per day, place and part of the day).
const FALLBACK_SEED = 'encounters';
// A pulse cue about a person this reply: no encounter beside it (one person cue a reply).
const PULSE_PEOPLE = new Set(['CHANCE_MEETING', 'ENTER_CHECK']);
const isInt = value => Number.isSafeInteger(value);
const skip = skipped => ({ summary: '', narrate: false, data: { skipped } });

/** `director.encounter { at }`: roll this reply's encounter (one per place and part of a day), record it, and tell the narrator one line. */
export function encounterCommand(ctx, payload = {}) {
    if (ctx?.cause === 'ui') return ctx.fail('REFUSED', 'Encounters are rolled by Story Director itself.');
    const at = payload?.at;
    if (!(isInt(at) && at >= 0)) return ctx.fail('INVALID', 'director.encounter: "at" must be the chat\'s length (a whole number).');
    const director = ctx.draft('director');
    const read = name => { try { return typeof ctx.read === 'function' ? ctx.read(name) : null; } catch { return null; } };
    const state = { domains: { director, scene: read('scene'), cast: read('cast'), chronicle: read('chronicle') } };
    const query = typeof ctx.query === 'function' ? (name, args) => ctx.query(name, args) : null;
    const clock = director.time?.minutes;
    if (!isInt(clock)) return skip('no clock');
    if (fightOn(query, state)) return skip('fight');
    if (resultsOf(director).some(entry => entry.at === at && PULSE_PEOPLE.has(entry.kind))) return skip('pulse');
    if (slotOf(state.domains.cast?.meeting)?.at === at) return skip('meeting');
    const here = hereOf(query, state, ctx);
    if (!here) return skip('no place');
    const ledger = ledgerOf(director);
    const time = timeOfDay(clock);
    const day = dayOf(clock);
    const key = sceneKey(here.place, time);
    if (ledger.results.some(entry => entry.at !== at && entry.day === day && entry.key === key)) return skip('told');
    const seed = isWorldSeed(state.domains.chronicle?.worldSeed) ? state.domains.chronicle.worldSeed : FALLBACK_SEED;
    const rows = encounterTable({ place: here.place, pack: here.pack, cast: here.cast, ledger, time, conditions: here.conditions, present: here.present });
    const { row, draw } = rollEncounter(rows, { seed, day, key });
    if (!row) return skip('no table');
    const entry = {
        at, day, key, kind: row.kind, ref: row.ref, who: row.who, look: row.look, place: here.place.name, seen: row.seen, recurring: row.recurring,
        draw: Math.round(draw * 1000) / 1000, ...(row.name ? { name: row.name } : {}), ...(row.npc ? { npc: row.npc } : {}),
    };
    director.encounters = toSlot(withResult(ledger, entry));
    const line = encounterLine(entry);
    return { summary: line, narrate: Boolean(line), data: { keep: true, kind: entry.kind, ref: entry.ref, ...(here.problems.length ? { problems: here.problems } : {}) } };
}

/** `director.encounter.promote { at, ref, key, name }` (after the reply's lines): bind backdrop `ref` to NPC State's dossier `key`. */
export function promoteCommand(ctx, payload = {}) {
    if (ctx?.cause === 'ui') return ctx.fail('REFUSED', 'A promotion is Story Director\'s own step.');
    const { at, ref, key, name } = payload ?? {};
    if (!isInt(at) || ![ref, key, name].every(value => typeof value === 'string' && value.trim())) return ctx.fail('INVALID', 'director.encounter.promote takes { at, ref, key, name }.');
    const director = ctx.draft('director');
    const ledger = ledgerOf(director);
    const was = ledger.results.find(entry => entry.ref === ref)?.who ?? ref;
    director.encounters = toSlot(withBinding(ledger, { ref, key, name: name.trim(), at }));
    return { summary: `${name.trim()} is now in People (was ${was}).`, narrate: false, data: { ref, key } };
}
