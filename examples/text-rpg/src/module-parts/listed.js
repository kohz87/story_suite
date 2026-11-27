// Which active skills the prompt lists for a member: the 8 most practised, plus any the latest messages name.
import { practiceOf } from './practice.js';
import { activeSkills } from './effective.js';

const TOP = 8;
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Whether `name` stands in `text` as whole words, in any case. */
function named(name, text) {
    const word = String(name ?? '').trim();
    return word !== '' && new RegExp(`(?<![\\p{L}\\p{N}])${escape(word)}(?![\\p{L}\\p{N}])`, 'iu').test(text);
}

/** The text the reader's last message and the last reply make: what names a skill into the prompt. */
export const namedText = view => `${view?.chat?.lastUser ?? ''}\n${view?.chat?.lastReply ?? ''}`;

/**
 * The active skills the capability line and the dice note's table list, in sheet order: the 8 with the highest practice (ties: creation skills first,
 * then learn order) and any other active skill `text` names. A `? try` may still use any active skill.
 */
export function listedSkills(member, text = '') {
    const active = activeSkills(member);
    const order = skill => (Number.isInteger(skill.learned) ? skill.learned : -1);
    const top = new Set([...active].sort((a, b) => practiceOf(member, b) - practiceOf(member, a) || order(a) - order(b)).slice(0, TOP));
    return active.filter(skill => top.has(skill) || named(skill.name, text));
}
