// The stance skill types of Combat Rules v1 (a Skills block of those rules): an owner holds at most one. The list is the one combat/numbers.js calls `kind: 'stance'`
// (a test holds the two equal); it lives here, outside lean-rpg/, so the learn route (page start) needs none of the combat files.
export const STANCE_TYPES = Object.freeze(['defence', 'speed', 'focus']);
// The other words a story line, a character file, a pack or a skill set may write for a stance type (the earlier Evasion and Movement stances are Speed, Support is
// Focus); the same words as numbers.js's aliases, held equal by a test.
export const STANCE_ALIASES = Object.freeze({ evasion: 'speed', movement: 'speed', agility: 'speed', swift: 'speed', support: 'focus', channel: 'focus', auxiliary: 'focus' });
// A Focus stance rolls with INT or WIS only (numbers.js V1.focus.stats); any other stat is refused where a skill is learned.
export const FOCUS_STATS = Object.freeze(['int', 'wis']);
/** A skill type word as the Skills block stores it: an alias of a stance type becomes that type (folded); any other word is returned as given. */
export const stanceTypeOf = word => (typeof word === 'string' && Object.hasOwn(STANCE_ALIASES, word.trim().toLowerCase()) ? STANCE_ALIASES[word.trim().toLowerCase()] : word);
