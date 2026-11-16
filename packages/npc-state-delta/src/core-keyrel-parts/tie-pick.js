/* NPC State Delta tie pick: the one tag a list of tie tags stands for, shared by a tie's type (tieType) and its word on the map and in Focus. */
import { TIE_TAGS } from '../npc-notes-ties-parts/shared-tags.js';

const OLD_TAGS = ['ally', 'rival', 'owes'];

/** The one tag a stored tag list gives, or ''. A list of only ally/rival/owes picks as it always did (owes, else the first stored tag);
 *  a list holding any newer tag picks hostile first (enemy, rival), then duty (owes, serves), then the rest in tag order. */
export function pickTieTag(tags) {
    const list = (Array.isArray(tags) ? tags : []).filter(tag => TIE_TAGS.includes(tag));
    if (!list.length) return '';
    if (list.every(tag => OLD_TAGS.includes(tag))) return list.includes('owes') ? 'owes' : list[0];
    return ['enemy', 'rival', 'owes', 'serves'].find(tag => list.includes(tag)) || TIE_TAGS.find(tag => list.includes(tag));
}
