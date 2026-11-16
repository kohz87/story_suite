// Story Director: fight, reach and off-screen fight annotations for note items.

import { ITEM_SEPARATOR, fieldOf } from '../note-format.js';
import { encounterOf } from './shared-fields.js';

// "Ambush at the weir (Haywane 14) (fight: 3 bandit, bandit captain (boss))": a due fight
// says who is coming, so the storyteller can bring them on.
export function withFight(item, record) {
    const foes = encounterOf(record);
    return foes ? `${item} (fight: ${foes})` : item;
}

// (0.9.19) "… · reach: the inn shuts for repairs": what a due beat changes for {{user}} wherever
// they are, so a story away from it has concrete aftermath to show rather than nothing. Due
// now only: a beat still ahead keeps its reach off the Beats line, so the note stays short and
// the story is not handed an aftermath before the beat has happened.
export function withReach(item, record) {
    const reach = fieldOf(record, 'reach');
    return reach ? `${item}${ITEM_SEPARATOR}reach: ${reach}` : item;
}

// The compact form for the kind lines: the fight is planned, not happening yet.
export function fightPart(record) {
    const foes = encounterOf(record);
    return foes ? `${ITEM_SEPARATOR}fight: ${foes}` : '';
}

export function withAwayFight(item, record) {
    const foes = encounterOf(record);
    return foes ? `${item} (fought off-screen: ${foes})` : item;
}
