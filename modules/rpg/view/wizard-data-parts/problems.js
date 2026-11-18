// What holds Create up, and the block actions a reply has left for it.

import { DM_LIMITS } from '../../../data-modules/schema.js';
import { PARTY_ACTIVE } from '../../names.js';
import { fold } from '../../read.js';
import { skillCost } from '../../combat/skills.js';
import { RPG_STRINGS, fill } from '../../strings.js';

const W = RPG_STRINGS.wizard;

/** The block actions Create may need on one reply: the Character's define, the Skills' define, and taking the Character back if the second fails. */
export const CREATE_ACTIONS = 3;

/** How many block actions the reply keeps for (`key` is the head reply's, `${sid}/${swipeKey}`); all of them when the key is not known. */
export function actionsFree(state, key) {
    const used = key ? state?.domains?.dataModules?.perReply?.[key]?.roots : 0;
    return DM_LIMITS.replyRoots - (Number.isSafeInteger(used) ? used : 0);
}

/** What Create is held up by, as plain sentences ([] when it may go). `world`: { persona, names (the characters' names now), room (whether two more blocks fit), started (false while the chat has no state yet), hasYou, free (block actions the reply has left) }. */
export function problemsOf(draft, { persona = '', names = [], room = true, hasYou = false, free = DM_LIMITS.replyRoots, full = false, started = true } = {}) {
    const out = [];
    // (a chat with no first message has no story state to hold the character: Create says so up front, as the failed Create would)
    if (!started) out.push(W.noChat);
    const name = draft.name;
    if (!name) out.push(W.needName);
    else if (names.some(other => fold(other) === fold(name))) out.push(fill(W.nameTaken, { name }));
    const mine = persona && name && fold(name) === fold(persona);
    if (name && persona) {
        if (draft.kind === 'you' && !mine) out.push(fill(W.youName, { persona }));
        if (draft.kind === 'companion' && mine) out.push(fill(W.companionName, { persona }));
    }
    if (draft.kind === 'you' && hasYou) out.push(W.youTaken);
    const seen = new Set();
    for (const skill of draft.skills) {
        if (!skill.name) { out.push(W.needSkillName); continue; }
        if (seen.has(fold(skill.name))) out.push(fill(W.sameSkill, { name: skill.name }));
        seen.add(fold(skill.name));
        if (!skill.about) out.push(fill(W.needAbout, { name: skill.name }));
        if (!skill.stat) out.push(fill(W.needStat, { name: skill.name }));
    }
    // (Combat Rules v1: one stance skill; a second would sit at practice 0, so Create waits for the reader to change a type)
    const stances = draft.skills.filter(skill => skill.name && skillCost({ type: skill.type ?? 'attack', stat: skill.stat }).kind === 'stance').map(skill => skill.name);
    if (stances.length > 1) out.push(fill(W.twoStances, { names: stances.join(', ') }));
    if (full) out.push(fill(RPG_STRINGS.join.fullActive, { max: PARTY_ACTIVE }));   // (the same sentence a `+ party` line is refused with)
    if (!room) out.push(fill(W.noRoom, { max: DM_LIMITS.definitions }));
    else if (free < CREATE_ACTIONS) out.push(fill(W.noActions, { used: DM_LIMITS.replyRoots - free, max: DM_LIMITS.replyRoots, need: CREATE_ACTIONS }));
    return [...new Set(out)];
}
