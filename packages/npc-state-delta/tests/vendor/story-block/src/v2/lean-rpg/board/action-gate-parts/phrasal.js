// Finds attacks in a clause: plain attack words and phrasal shapes.
import { ATTACK, WEAPON } from './attack-words.js';

// Phrasal attacks. kind 'into': the object moved is a WEAPON word and the words after the link name a creature, a body part or him/her
// (or the target is a creature noun whatever is moved); 'creature': the words after must name a creature; 'mid': the thing taken by
// surprise must be a creature; 'free': the verb alone. The mid words are never a vehicle, load or place. Idioms never count.
const LOAD = new Set(['cart', 'handcart', 'wagon', 'barrow', 'town', 'yard', 'cellar', 'meat', 'home', 'sack', 'crate', 'load', 'cargo']);
const CREATURE = new Set(['them', 'boar', 'sow', 'pig', 'beast', 'wolf', 'bear', 'rat', 'bandit', 'guard', 'thug', 'man', 'woman', 'creature', 'monster', 'foe', 'enemy', 'enemie', 'brute', 'goblin', 'orc', 'skeleton', 'zombie', 'spider', 'snake', 'dog', 'hound', 'stag', 'men', 'women', 'ogre', 'troll', 'thief', 'raider', 'cultist', 'soldier', 'knight', 'drake', 'wyrm', 'bat', 'ghoul', 'imp']);
const BODY = new Set(['him', 'her', 'skull', 'throat', 'eye', 'head', 'neck', 'leg', 'belly', 'flank', 'face', 'chest', 'rib', 'back', 'jaw', 'snout', 'shoulder', 'arm', 'hand', 'tusk', 'hide']);
const IDIOM = /^\s*(?:a|an|the|my|our|his|her)?\s*(?:deal|bargain|pose|match|balance|chord|rope|cards|cord|smile|joke|grin)s?\b/iu;
const PHRASAL = [
    [/\b(driv(?:e|es|ing)|drove|plung(?:e|es|ed|ing)|sink|sinks|sank|sinking|bur(?:y|ies|ied|ying))\b(.{0,40}?)\s(into)\s+(.*)$/iu, 'into'],
    [/\b(bring|brings|bringing|brought)\b(.{0,40}?)\s(down\s+(?:on|upon))\s+(.*)$/iu, 'into'],
    [/\b(go|goes|going|went)()\s(for)\s+(.*)$/iu, 'creature'],
    [/\b(rush|rushes|rushed|rushing)()\s(at)\s+(.*)$/iu, 'creature'],
    [/\b(hurl(?:s|ed|ing)?)\b(.{0,40}?)\s(at)\s+(.*)$/iu, 'creature'],
    [/\b(tak(?:e|es|ing)|took|cut(?:s|ting)?|strik(?:e|es|ing)|struck)()\s(down)\s+(.*)$/iu, 'creature'],
    [/\b(smash(?:es|ed|ing)?|bash(?:es|ed|ing)?|club(?:s|bed|bing)?|jab(?:s|bed|bing)?|crack(?:s|ed|ing)?)\b()()()(.*)$/iu, 'creature'],
    [/\b(lash(?:es|ed|ing)?\s+out)\b()()()/iu, 'free'],
    [/\b(tak(?:e|es|ing)|took)\b(.{0,30}?)\s(by\s+surprise)\b()/iu, 'mid'],
    [/\b(bludgeon(?:s|ed|ing)?|maul(?:s|ed|ing)?)\b()()()/iu, 'free'],
];
const wordsIn = text => (String(text).toLowerCase().match(/\p{L}+/gu) ?? []);
const base = word => word.replace(/s$/u, '');
const first = (text, set) => wordsIn(text).slice(0, 5).some(word => set.has(word) || set.has(base(word)));
export const namesCreature = text => first(text, CREATURE);

/** Every attack in a clause as `{ index, length }` (the verb only), plain attack words and the phrasal shapes alike, in order; [] when none. */
export function findAttacks(clause) {
    const found = [];
    for (const bare of clause.matchAll(new RegExp(ATTACK.source, 'giu'))) {
        if (IDIOM.test(clause.slice(bare.index + bare[0].length))) continue;
        found.push({ index: bare.index, length: bare[0].length });
    }
    for (const [rule, kind] of PHRASAL) {
        const match = rule.exec(clause);
        if (!match || wordsIn(match[2]).some(word => LOAD.has(word))) continue;
        const after = match[5] ?? match[4];
        if (kind === 'creature' && !namesCreature(after)) continue;
        if (kind === 'mid' && !namesCreature(match[2])) continue;
        if (kind === 'into' && !namesCreature(after)
            && !(wordsIn(match[2]).some(word => WEAPON.has(word) || WEAPON.has(base(word))) && first(after, BODY))) continue;
        found.push({ index: match.index, length: match[1].length });
    }
    return found.sort((a, b) => a.index - b.index);
}
/** The first attack in a clause, or null. */
export const findAttack = clause => findAttacks(clause)[0] ?? null;
