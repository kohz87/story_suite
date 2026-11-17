// World events on the host: `chronicle.world.cue` (switch story-director.world-events), the must-happen death cue after each reply
// (spec v0.14.5 §8 Deaths, ruling 34; daily/cues.js). Run by code after a reply's lines while a cue an earlier reply made is pending:
// the narrator wrote the death (NPC State recorded the person dead: a dossier made from the pack, `castFrom.id`, with an explicit
// death) → applied now; else the reply counts, and the third such reply applies it by code with a Journal line and a Problems note.
// The step's state is a slot written whole, so a swipe of the reply that wrote the death puts the cue back and the count goes on
// from the recorded replies. An unmet person's death is mirrored into the cast store (never a dossier).

import { revOf } from '../domain-parts/lookup.js';
import { slotValue, toSlot } from '../../../rpg/slot.js';
import { worldEventsOn } from '../capture/world-parts/switch.js';
import { WORLD_EVENTS_FEATURE } from '../conditions/feature.js';
import { settleCues } from '../../daily/cues.js';
import { readWorld } from './read-world.js';
import { mirrorCast, tickInputs } from './cast-tie.js';

export const CUE = 'chronicle.world.cue';

// NPC State's confirmed death (its terminal-lifecycle rule, read from the stored dossier: `lifeState` deceased, certainty explicit).
const deadDossier = npc => String(npc?.lifeState ?? '').trim().toLowerCase() === 'deceased' && String(npc?.lifeStateCertainty ?? '').trim().toLowerCase() === 'explicit';

/** The pack ids NPC State holds dead (explicit deaths of dossiers made from the pack). */
export function deadIds(people) {
    const npcs = people?.npcs && typeof people.npcs === 'object' ? people.npcs : {};
    return new Set(Object.values(npcs).filter(npc => typeof npc?.castFrom?.id === 'string' && deadDossier(npc)).map(npc => npc.castFrom.id));
}

function cue(ctx) {
    if (ctx.cause !== 'system' || ctx.caller) return ctx.fail('REFUSED', 'The world settles its cues only when code checks them after a reply.');
    if (!worldEventsOn(ctx)) return ctx.fail('REFUSED', 'World events are off.');
    const chronicle = ctx.draft('chronicle');
    const state = slotValue(chronicle.daily);
    let people = null;
    try { people = ctx.read('people'); } catch { people = null; }
    const world = readWorld((name, args) => ctx.query(name, args));
    const names = new Map((Array.isArray(world.cast) ? world.cast : []).filter(entry => typeof entry?.id === 'string').map(entry => [entry.id, entry.name ?? entry.id]));
    const out = state ? settleCues(state, { dead: deadIds(people), rev: revOf(ctx), names }) : null;
    if (!out) return { summary: '', narrate: false, data: { applied: [] } };
    chronicle.daily = toSlot(out.daily);
    let cast = null;
    try { cast = ctx.draft('cast'); } catch { cast = null; }
    if (cast && out.applied.length) {
        const tie = tickInputs(ctx, cast, world.cast);
        mirrorCast(ctx, cast, { deaths: out.applied.map(item => ({ id: item.id })) }, tie.keys, null);
    }
    // A death code applies to someone with a dossier goes to NPC State as its death (seam audit E5: people.died, under this module).
    const npcs = people?.npcs && typeof people.npcs === 'object' ? people.npcs : {};
    for (const item of out.applied.filter(each => each.how === 'fallback')) {
        const id = Object.keys(npcs).sort().find(key => npcs[key]?.castFrom?.id === item.id && !deadDossier(npcs[key]));
        if (id) { try { ctx.call('people.died', { id, reason: out.journal.find(entry => entry.text.startsWith(names.get(item.id) ?? item.id))?.text ?? 'died', sid: null }); } catch { /* the world's record stands */ } }
    }
    const summary = out.journal.map(entry => entry.text).join(' ');
    return { summary, narrate: false, data: { applied: out.applied }, ...(out.problem ? { problem: out.problem } : {}) };
}

/** The command, tagged with the feature and internal (never from a click or the sdk). */
export const cueCommand = Object.assign(cue, { feature: WORLD_EVENTS_FEATURE });
Object.defineProperty(cueCommand, 'internal', { value: true, enumerable: true });
