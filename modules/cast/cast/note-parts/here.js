// Story Director v2, part **cast**: the narrator's line of the world's own people at the scene's place (LA-2).
//
// A format 4 world cast entry (a `figure` or a `companion`) not yet met who is at the scene's place, or at its parent place, is named to the
// narrator with their role, look, manner and voice, so a scene that needs a watch-captain uses the world's own (Edda Rorke) instead of inventing a
// double, and someone the narration brings in speaks as their entry says from the first line (owner, 20 Nov: a shy healer came in brisk). Only the
// public face is told (name, role, look, the start of their personality and voice): never a secret, a history or anything gated. The line is prompt-only (never a receipt, card or
// toast), and the narration uses a name only after someone in the story says it. Someone this reply's meeting brings in is named by the meeting's
// cue (cue.js), and anyone met is known to the story, so only the unmet are here. Pure: the line is read from the state and the packs each reply,
// so a swipe, a rewind or a reload sends the same line.

import { cutWords, isMet } from '../domain.js';
import { isPersona } from '../../../time/tracker/initiative.js';
import { movable } from '../world-parts/movable.js';

/** At most this many people on the line, and this much of each one's role, look, manner and voice. */
export const HERE_MAX = 4;
const ROLE_MAX = 60;
const LOOK_MAX = 90;
const MANNER_MAX = 70;
const VOICE_MAX = 90;
const KINDS = new Set(['figure', 'companion']);

// One instruction, worded for any persona name (no verb agrees with {{user}}); the list follows it.
const HEAD = '[People here] The world\'s own people at this place or nearby, not necessarily in the scene. When the story needs someone of their role, use that person by this name rather than making up someone new; the narration uses a name only after someone in the story says it:';

// 0: at the scene's place itself; 1: at its parent (the atlas's saved parent, else the "Town / Spot" a name writes first, else the town of the
// party's place line); null: anywhere else, a sibling, a district under it or a grandparent included (only the place and its parent are told).
function rankOf(where, party) {
    if (!where) return null;
    if (typeof party.locate === 'function' && !party.old) {
        const here = party.locate(party.place);
        const there = party.locate(where);
        if (!here?.key || !there?.key) return null;
        if (there.key === here.key) return 0;
        // (a place the story saved with only a region, "~ place South Granary | region: Bluewatch Village", has that region as its parent: owner, 21 Nov, the village's healer was left out and made up)
        const parent = here.up[0]?.key ?? (party.town ? party.locate(party.town)?.key : null) ?? (party.region ? party.locate(party.region)?.key : null);
        return parent && there.key === parent ? 1 : null;
    }
    const same = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
    if (same(where, party.place)) return 0;
    const town = String(party.place).includes('/') ? String(party.place).split('/')[0] : party.town || party.region;
    return town && same(where, town) ? 1 : null;
}

/**
 * The line for the reply being written, or '' for nobody. `frame`: `{ cast, party, present, pinned }` (hooks-parts/frame.js); `slice`: the cast
 * state as this reply's steps left it (a meeting made for this reply has marked its people met); `persona`: the player's name.
 */
export function hereLine(slice, frame, { persona = '' } = {}) {
    if (!frame?.cast?.entries?.length || !frame.party?.place) return '';
    const order = new Map(frame.cast.entries.map((entry, index) => [entry.key, index]));
    // The scene's place first, then its parent, each in the pack's order; then cut to the cap.
    const people = movable(slice, frame.cast, { present: frame.present ?? new Set(), pinned: frame.pinned ?? new Set() })
        .filter(item => KINDS.has(item.entry.raw?.kind) && !isMet(item.person))
        .filter(item => !isPersona({ key: item.key, name: item.person?.name, names: item.person?.aliases }, persona))
        .map(item => ({ ...item, rank: rankOf(item.person.where, frame.party) }))
        .filter(item => item.rank !== null)
        .sort((a, b) => a.rank - b.rank || order.get(a.key) - order.get(b.key))
        .slice(0, HERE_MAX);
    if (!people.length) return '';
    const said = people.map(({ entry }) => {
        // (a "; " stays the list's own separator: one inside a role or look reads as a comma)
        const role = cutWords(String(entry.raw?.role ?? '').replace(/;/g, ','), ROLE_MAX);
        const species = String(entry.raw?.species ?? '').trim().replace(/;/g, ',');
        // (the race leads the look when the look doesn't name it, so the narrator never guesses it)
        const look = cutWords(`${species && !String(entry.raw?.look ?? '').toLowerCase().includes(species.toLowerCase()) ? `${species}. ` : ''}${String(entry.raw?.look ?? '')}`.replace(/;/g, ','), LOOK_MAX);
        // (the first sentence of the personality, and the voice, so the first lines they speak are theirs)
        const manner = cutWords(String(entry.raw?.personality ?? '').split(/(?<=[.!?])\s/)[0].replace(/;/g, ',').replace(/[.]$/, ''), MANNER_MAX);
        const voice = cutWords(String(entry.raw?.voice ?? '').replace(/;/g, ',').replace(/[.]$/, ''), VOICE_MAX);
        return `${entry.name}${role ? `, ${role}` : ''}${look ? ` (${look.replace(/[.]$/, '')})` : ''}${manner ? `, manner: ${manner}` : ''}${voice ? `, speaks: ${voice}` : ''}`;
    });
    return `${HEAD} ${said.join('; ')}.`;
}
