// The v1 sheet read for a fight: pure functions from what readSheet gives for Combat Rules v1 blocks (`characters` with `v1: true`, foe slots with `v1: true`)
// to the engine's input ({ party, foes }) and to the guard's witness input. Nothing here reads state, settings or dice.

import { foeMembers } from './foes.js';
import { skillsOf } from './profile.js';
import { rankOf } from './skills.js';

// A hero's mastery is the best rank in force (practice AND level, skills.js rankOf) over its skills; no skill reads as the first rank.
function masteryOf(character) {
    return Math.max(rankOf(0, character.level).mastery, ...(character.skills ?? []).map(skill => rankOf(skill.practice, character.level).mastery));
}

function heroOf(character) {
    const max = character.max ?? {};
    return {
        id: character.key, label: character.who, module: character.module, level: character.level, stats: { ...character.stats }, mastery: masteryOf(character),
        hp: character.hp, mp: character.mp, sp: character.sp, maxHp: max.hp, maxMp: max.mp, maxSp: max.sp,
        skills: skillsOf({ skills: character.skills }),
    };
}

function foesOf(slot, carried) {
    const members = foeMembers({ name: slot.name, count: slot.count, level: slot.level, tier: slot.tier });
    return members.map(member => {
        const id = `${slot.slot}.${member.n}`, kept = carried.get(id);
        return { ...member, id, label: members.length > 1 ? `${member.name} ${member.n}` : member.name, slot: slot.slot, ...(kept ? { hp: kept.hp } : {}) };
    });
}

/**
 * The engine input of a v1 sheet: `{ party, foes, groups }`. The party is every v1 character still alive (a Down hero stays, at 0 HP); with a `carried` record it is exactly the record's `order.party` (a hero who died since stays, at the sheet's bars, so the carried start still matches); the foes are the
 * members of every filled v1 slot at full HP (`id` `<slot>.<n>`), or at the HP the `carried` record (an earlier segment's `{ foes }`) left them; `groups` are the slots.
 */
export function fightInputOf(sheet, { carried = null } = {}) {
    const kept = new Map((carried?.foes ?? []).map(foe => [String(foe.id), foe])), roster = carried?.order?.party ? new Set(carried.order.party.map(String)) : null;
    const slots = (sheet?.foes ?? []).filter(slot => slot?.v1 === true && slot.filled);
    return {
        party: (sheet?.characters ?? []).filter(character => character?.v1 === true && (roster ? roster.has(String(character.key)) : character.alive !== false)).map(heroOf),
        foes: slots.flatMap(slot => foesOf(slot, kept)), groups: slots.map(slot => slot.slot),
    };
}

/** What the guard witnesses of a v1 fight's start: exactly the data the engine reads (the input above, at full foe HP), under a v1 marker. */
export function witnessOf(sheet) {
    const input = fightInputOf(sheet);
    return { v1: 1, party: input.party.map(({ module, ...hero }) => hero), foes: input.foes, groups: input.groups };
}
