// Tells whether a message reads as a fight (action words, a drawn weapon, or a sheet skill named).

import { fold } from '../../../packages/story-block/src/v2/lean-rpg/read.js';

// The gate for a known fight must not turn a conversation or a quiet observation into a fight.
const ACTION = /\b(?:attack\w*|strik\w*|struck|stab\w*|slash\w*|hit(?:s|ting)?|punch\w*|kick\w*|swing\w*|swung|smash\w*|bash\w*|fight\w*|fought|battl\w*|duel\w*|kill\w*|slay\w*|slew|smite\w*|shoot\w*|shot|hurl\w*|throw\w*|threw|cast\w*|charge\w*|ambush\w*|grappl\w*|tackl\w*|shov\w*|disarm\w*|block\w*|brac\w*|parr\w*|dodg\w*|evad\w*|defend\w*|guard\w*|lunge\w*|thrust\w*|engag\w*|assault\w*|pounc\w*|jump\w*|leap\w*|leapt|fall(?:s|ing)?\s+upon|fell\s+upon|flee\w*|fled|run\w*|ran|escap\w*|retreat\w*|cut\w*|slic\w*|cleav\w*|hack\w*|brawl\w*)\b/iu;
const WEAPON_ACTION = /\b(?:fire|fires|fired|firing|draw|draws|drew|drawing|loose|loosed|aim|aims|aimed)\b[^.!?]{0,35}\b(?:at|arrow|bow|bolt|blade|sword|dagger|weapon|gun|spear)\b/iu;
export function fightsInMessage(text, sheet) {
    if (ACTION.test(String(text ?? '')) || WEAPON_ACTION.test(String(text ?? ''))) return true;
    const message = fold(String(text ?? ''));
    return (sheet?.characters ?? []).some(actor => (actor.skills ?? []).some(skill => {
        const name = fold(skill.name);
        return name.length >= 4 && message.includes(name);
    }));
}
