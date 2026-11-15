// Names callers take from this file that live in the neighbours: the look stamp pair and the caught-lie rule.
import { CAUGHT_TIER, CAUGHT_DROP } from '../npc-notes-lies.js';
import { readLookStamp, lookStamp } from '../npc-notes-look.js';
export { lookStamp, readLookStamp };

// A caught lie costs about six trust (owner decision); only the extreme tier's cap lets a step that big land, and it is counted
// in that tier's events per story day.
// (Both live in npc-notes-lies.js, the one source.)
export { CAUGHT_TIER, CAUGHT_DROP };
