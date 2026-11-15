// The social skill a check's skill word means, and the words that name each skill.
import { words } from './shared-text.js';

/** The words a check may name, by the skill they mean (matched as whole words, any case). */
export const SKILL_WORDS = Object.freeze({
    persuade: Object.freeze(['persuade', 'persuasion', 'convince', 'negotiate', 'negotiation', 'diplomacy', 'plead', 'bargain', 'barter', 'haggle']),
    charm: Object.freeze(['charm', 'seduce', 'seduction', 'flirt', 'flirting', 'allure']),
    intimidate: Object.freeze(['intimidate', 'intimidation', 'threaten', 'coerce', 'menace', 'bully']),
    deceive: Object.freeze(['deceive', 'deception', 'lie', 'bluff', 'trickery', 'mislead', 'feint']),
    social: Object.freeze(['social', 'charisma', 'cha', 'speech', 'speechcraft', 'etiquette', 'rapport']),
});

const SKILL_BY_WORD = new Map(Object.entries(SKILL_WORDS).flatMap(([skill, list]) => list.map(word => [word, skill])));


/**
 * The social skill a check's skill word means, or null: "Persuasion" → persuade, "seduce" → charm,
 * "Deception (CHA)" → deceive, "cha" → social. The first word that names a skill decides.
 */
export function socialSkill(value) {
    if (typeof value !== 'string') return null;
    for (const word of words(value)) {
        const skill = SKILL_BY_WORD.get(word);
        if (skill) return skill;
    }
    return null;
}
