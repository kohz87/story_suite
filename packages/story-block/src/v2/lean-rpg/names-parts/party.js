// Names: the join setting and the party limits.

/**
 * Companions who join (mockup section 8): the setting `rpgJoin` says what the story's `+ party Name | …` line does. 'ask' (the default)
 * puts a card under the reply and makes nothing until the reader says so; 'auto' makes the companion at once; 'off' leaves the line out
 * of the narrator's grammar. A party holds at most PARTY_MAX active characters (the ones who left do not count; a reply from before the `partyRoom` mark counts them, as it did).
 */
export const JOIN_SETTING = 'rpgJoin';
export const JOINS = Object.freeze(['ask', 'auto', 'off']);
export const PARTY_MAX = 8;
/** The active limit of a reply captured under the `partyFour` mark: four, the reader's own character included. A full party asks who to bench (join.js benchCard). */
export const PARTY_ACTIVE = 4;
