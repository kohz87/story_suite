/* NPC State Delta tie types: the five tie kinds, their priority ranks, fade days and the keyword reading of a relation text. */
import { pickTieTag } from './tie-pick.js';
// ---- Tie types, fading and priority (owner decisions 12 Nov). All pure; no model call. ----
// A tie's type is one of five broad kinds, read from the stored relation text with the fixed keyword table below (first matching row
// wins, in this order); no match, or a weak/one-time word, is Passing. A type set by a pack or the player (a `~ tie` tag) wins over the words.
export const TIE_TYPE_LABELS = Object.freeze({ kin: 'Kin', partner: 'Partner', friend: 'Friend', ally: 'Ally', mentor: 'Mentor', serves: 'Serves', rival: 'Rival', enemy: 'Enemy', owes: 'Owes', interest: 'Interest', passing: 'Passing' });
// Priority: every tie-tag type (kin, partner, friend, ally, mentor, serves, rival, enemy, owes; high) > Interest > Passing. Rank 0 is the strongest.
export const TIE_TYPE_RANK = Object.freeze({ kin: 0, partner: 0, friend: 0, ally: 0, mentor: 0, serves: 0, rival: 0, enemy: 0, owes: 0, interest: 1, passing: 2 });
// Story days without a mention before a tie fades (one constant per tier; the owner's 14 days is the middle tier).
export const TIE_FADE_DAYS = Object.freeze({ passing: 7, interest: 14, high: 30 });
const TIE_KEYWORDS = [
    ['rival', /\b(?:rival|rivals|enemy|enemies|nemesis|foe|adversary|antagonist|arch-?enem\w*|feud\w*|hostile|hates?|loathes?|bitter)\b/i],
    ['owes', /\b(?:owes|owing|indebted|debt|beholden|creditor|obligated|oath-?bound|sworn to|saved (?:her|his|their|my) life|rescued (?:her|his|their))\b/i],
    ['ally', /\b(?:ally|allies|friends?|best friend|partner|spouse|wife|husband|lover|fianc\w+|betrothed|girlfriend|boyfriend|mother|father|parents?|mom|dad|sister|brother|sibling|daughter|son|cousin|aunt|uncle|grand\w+|family|kin|mentor|teacher|master|apprentice|student|companion|comrade|confidant\w*|guardian|ward|protector|bodyguard|crewmate|trusted|loyal|sworn)\b/i],
    ['interest', /\b(?:crush|attracted|attraction|curious|fascinat\w*|intrigu\w*|admires?|admirer|suitor|courting|flirt\w*|infatuat\w*|love interest|colleague|coworker|neighbou?r|client|employer|boss|employee|acquaintance|contact|regular)\b/i],
];
// "owed by" / "debtor": the OTHER person owes, so it is not an Owes tie for this one (owes is one-way); it falls through to the other rows.
const OWED_BY = /\b(?:owed by|owed to by|debtor)\b/i;

/** The type of one tie: `tags` (a pack/player tie tag list: any of the nine tie tags) wins, else the keyword table on the relation text. */
export function tieType(relation, tags = []) {
    const picked = pickTieTag(tags);
    if (picked) return picked;
    const text = String(relation ?? '').replace(OWED_BY, ' ');
    for (const [type, pattern] of TIE_KEYWORDS) if (pattern.test(text)) return type;
    return 'passing';
}
