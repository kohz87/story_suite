// Join: the setting's mode and what a `+ party` line may do in this story.

import { DM_LIMITS, DM_OLD_ROOM } from '../../data-modules/schema.js';
import { JOINS, JOIN_SETTING, PARTY_MAX } from '../names.js';
import { fold } from '../read.js';
import { RPG_STRINGS, fill } from '../strings.js';
import { hasRoom } from '../view/wizard-data.js';
import { partyCap, partyOf } from './party.js';

const J = RPG_STRINGS.join;

/** The setting's value: 'ask' (the default), 'auto' or 'off'. */
export const joinMode = values => (JOINS.includes(values?.[JOIN_SETTING]) ? values[JOIN_SETTING] : JOINS[0]);

/**
 * What a `+ party` line may do in this story: `{ ok: true, soul, returning }` (`returning`: the party entry of someone who left and is
 * back) or `{ ok: false, why }`. The refusals are the plain ones: the name is taken, the party is full (counting those who left, whose
 * sheets are kept), there is no room for the two blocks.
 */
export function checkJoin(state, request, room = DM_LIMITS, limit = PARTY_MAX) {
    const party = partyOf(state);
    const same = party.find(person => fold(person.name) === fold(request.name));
    // The party limit counts members who are in it; a reply captured before the `partyRoom` mark (room = DM_OLD_ROOM) counts those who left too, as it did.
    // `limit` is the one the reply was captured under (4 with the `partyFour` mark, else 8). A refusal for a full party says `full`, so a caller may offer a bench choice.
    const old = room === DM_OLD_ROOM;
    const crowd = old ? party.length : party.filter(person => !person.left).length;
    const fullWhy = fill(J.fullActive, { max: limit });
    if (same?.left) return !old && crowd >= limit ? { ok: false, full: true, back: true, why: fullWhy } : { ok: true, returning: same, soul: same.soul };
    if (same) return { ok: false, why: fill(J.taken, { name: same.name }) };
    if (crowd >= limit) return { ok: false, full: !old, why: old ? fill(J.full, { max: PARTY_MAX }) : fullWhy };
    if (!hasRoom(state, room)) return { ok: false, why: fill(J.noRoom, { max: room.definitions }) };
    return { ok: true, soul: Math.min(request.soul, partyCap(party)) };
}
