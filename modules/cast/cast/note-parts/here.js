// Story Director v2, part **cast**: the narrator's line of the world's own people at the scene's place (LA-2).
//
// A format 4 world cast entry (a `figure` or a `companion`) who is at the scene's place, or at its parent place, is named to the narrator
// with their role and look, so a scene that needs a watch-captain uses the world's own (Edda Rorke) instead of inventing a double. Only the
// public face is told (name, role, look): never a secret, a history or anything gated. The meeting cue still decides who comes into the scene
// and still does not hand the player the name; this line says the name is known only once it is said in the story. Pure: the line is read
// from the state and the packs each reply, so a swipe, a rewind or a reload sends the same line.

import { cutWords, isMet, slotOf } from '../domain.js';
import { isPersona } from '../../../time/tracker/initiative.js';
import { movable } from '../world-parts/movable.js';
import { meetingAt } from '../world-parts/shown.js';
import { meetingFresh } from './cue.js';

/** At most this many people on the line, and this much of each one's role and look. */
export const HERE_MAX = 4;
const ROLE_MAX = 60;
const LOOK_MAX = 90;
const KINDS = new Set(['figure', 'companion']);

const HEAD = '[People here] The world\'s own people at this place or close by (not necessarily in the scene). When the story needs someone of their role, use that person by this name instead of making up a new one; {{user}} knows a name only once it is said in the story:';

// 0: at the scene's place itself; 1: at its parent (the atlas's saved parent, else the "Town / Spot" a name writes first, else the town of the
// party's place line); null: anywhere else, a sibling, a district under it or a grandparent included (only the place and its parent are told).
function rankOf(where, party) {
    if (!where) return null;
    if (typeof party.locate === 'function' && !party.old) {
        const here = party.locate(party.place);
        const there = party.locate(where);
        if (!here?.key || !there?.key) return null;
        if (there.key === here.key) return 0;
        const parent = here.up[0]?.key ?? (party.town ? party.locate(party.town)?.key : null);
        return parent && there.key === parent ? 1 : null;
    }
    const same = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();
    if (same(where, party.place)) return 0;
    const town = String(party.place).includes('/') ? String(party.place).split('/')[0] : party.town;
    return town && same(where, town) ? 1 : null;
}

// Someone a fresh meeting brings in this reply under no name (the cue hides it) is still named here; anyone met earlier is known to the story.
function unknownToStory(person, fresh) {
    if (!isMet(person)) return true;
    return fresh.has(person.key) && person.met?.why !== 'story';
}

/**
 * The line for the reply being written (`at`: the chat's length), or '' for nobody. `frame`: `{ cast, party, present, pinned }` (hooks-parts/frame.js);
 * `slice`: the cast state as this reply's steps left it; `chat`: the messages (the meeting's reply is found in them); `persona`: the player's name.
 */
export function hereLine(slice, frame, { at = null, chat = null, persona = '' } = {}) {
    if (!frame?.cast?.entries?.length || !frame.party?.place) return '';
    const meeting = slotOf(slice?.meeting);
    const keys = meeting && meetingFresh([{ ...meeting, at: meetingAt(slice.meeting, chat) }], at) ? meeting.keys : [];
    const fresh = new Set(keys);
    const order = new Map(frame.cast.entries.map((entry, index) => [entry.key, index]));
    // The scene's place first, then its parent, each in the pack's order; then cut to the cap.
    const people = movable(slice, frame.cast, { present: frame.present ?? new Set(), pinned: frame.pinned ?? new Set() })
        .filter(item => KINDS.has(item.entry.raw?.kind) && unknownToStory(item.person, fresh))
        .filter(item => !isPersona({ key: item.key, name: item.person?.name, names: item.person?.aliases }, persona))
        .map(item => ({ ...item, rank: rankOf(item.person.where, frame.party) }))
        .filter(item => item.rank !== null)
        .sort((a, b) => a.rank - b.rank || order.get(a.key) - order.get(b.key))
        .slice(0, HERE_MAX);
    if (!people.length) return '';
    const said = people.map(({ entry }) => {
        const role = cutWords(entry.raw?.role ?? '', ROLE_MAX);
        const look = cutWords(entry.raw?.look ?? '', LOOK_MAX);
        return `${entry.name}${role ? `, ${role}` : ''}${look ? ` (${look.replace(/[.]$/, '')})` : ''}`;
    });
    return `${HEAD} ${said.join('; ')}.`;
}
