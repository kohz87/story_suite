// Reading a written how: value by its see and hear words.

// Rule mark (KNOW_RULE): `how:` is read by its words (see/hear families). Only new lines read so; a stored reply whose line was refused replays refused.
const SEE_WORDS = new Set(['saw', 'seen', 'see', 'sees', 'seeing', 'shown', 'show', 'showed', 'shows', 'witnessed', 'watched', 'verified', 'read', 'found', 'spotted', 'noticed', 'checked', 'inspected']);
const HEAR_WORDS = new Set(['heard', 'hear', 'hears', 'told', 'tell', 'said', 'overheard', 'rumour', 'rumor', 'rumours', 'rumors', 'gossip', 'reported', 'informed']);
/** The canonical 'saw' or 'heard' for a written `how:` value, or null when it names neither. Both kinds in one value give 'saw'. */
export function readHow(value) {
    const words = String(value ?? '').toLowerCase().match(/[a-z]+/g) ?? [];
    if (words.some(word => SEE_WORDS.has(word))) return 'saw';
    return words.some(word => HEAR_WORDS.has(word)) ? 'heard' : null;
}
