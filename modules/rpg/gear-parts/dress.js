// What a member's gear gives: the pieces and load worked out from the inventory's answers, and the guard's check that a record still matches the state.
import { readSheet } from '../read.js';
import { actorIdOf } from '../roster.js';
import { gearAnswer } from '../../inventory/gear.js';
import { condOf, defCarry, ENCUMBERED_PENALTY } from '../../inventory/index.js';
import { mountRows } from '../../scene/mounts.js';
import { ENCUMBERED } from './shared-marks.js';
import { ITEMS_MAX, NAME_MAX } from './shared-caps.js';
import { isObject, lower } from './shared-helpers.js';

/**
 * What the owners `own` of one member give: { add?, enc?, items? } from the inventory's answers (`answerOf(owner)`; `party` is the shared bag's, which also
 * says whether the load is too much). Shared by the roll (the live queries; old planner records too) and the guard (the state before the roll), so both read it the same way.
 */
export function dressOf(own, party, answerOf) {
    const add = {}, items = [];
    let enc = party.carry?.encumbered === true ? (Number.isSafeInteger(party.carry.penalty) && party.carry.penalty < 0 ? party.carry.penalty : ENCUMBERED) : 0;
    for (const answer of own.map(answerOf)) {
        if (!isObject(answer)) continue;
        for (const [stat, n] of Object.entries(lower(answer.statBonus))) add[stat] = (add[stat] ?? 0) + n;
        for (const piece of Object.values(isObject(answer.slots) ? answer.slots : {})) {
            const stats = piece && piece.broken !== true ? lower(piece.stats) : {};
            if (Object.keys(stats).length && typeof piece.name === 'string') items.push({ name: piece.name.replace(/\s+/g, ' ').trim().slice(0, NAME_MAX), stats });
        }
        if (answer.carry?.encumbered === true && !enc) enc = Number.isSafeInteger(answer.carry.penalty) && answer.carry.penalty < 0 ? answer.carry.penalty : ENCUMBERED;
    }
    return { ...(Object.keys(add).length ? { add } : {}), ...(enc ? { enc } : {}), ...(items.length ? { items: items.slice(0, ITEMS_MAX) } : {}) };
}

/**
 * Whether the pieces and the load `gear` (a roll's record) was worked out from are what the state before the roll holds: the same owners' worn pieces
 * (their stats and condition) and the same load. The state alone is asked (a guard sees no more); whether mounts counted is not in the state, so the
 * record may match with or without them. False when something before the roll changed (a reply that gave or equipped gear deleted, edited, swiped).
 */
export function gearMatches(state, gear, hash) {
    try {
        const stats = { condOf, carryOf: defCarry, penalty: ENCUMBERED_PENALTY };
        const withMounts = [[], mountRows(state)];
        // (whose the pieces were: an owner that is a Character block's actor must be the actor of the block the entry is for; the owners of a roster of another make cannot be told here)
        const mine = new Map(readSheet(state).characters.map(character => [actorIdOf(character.module), character.key]));
        const owned = (key, entry) => (entry?.own ?? []).every(owner => !mine.has(owner) || mine.get(owner) === key);
        return Object.entries(gear?.who ?? {}).every(([key, entry]) => owned(key, entry) && withMounts.some(mounts => {
            const answerOf = owner => gearAnswer(state, { owner }, { ...stats, mounts });
            const now = dressOf(entry.own, answerOf('party'), answerOf);
            return hash({ add: now.add ?? null, enc: now.enc ?? null, items: now.items ?? null }) === hash({ add: entry.add ?? null, enc: entry.enc ?? null, items: entry.items ?? null });
        }));
    } catch { return false; }
}
