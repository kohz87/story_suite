// The read-time tie tags a bond relation word implies (never stored).
import { clean } from '../npc-meters-config.js';
import { socialRelationFamily } from '../../social-relations.js';
import { ordered } from './shared-tags.js';
import { NAME_MAX } from './shared-object.js';

const ALLY_FAMILIES = new Set(['friend', 'partner', 'ally']);
const RIVAL_FAMILIES = new Set(['rival', 'enemy']);
const OWES_FAMILIES = new Set(['benefactor', 'creditor']);

/** The tags a bond's relation word implies, read from this person's side (no storage). benefactor or creditor: this one owes them;
 * friend, partner or ally: ally; rival or enemy: rival. A debtor owes this one, which is stored on their side (see owedBy), so none here. */
export function tagsFromRelation(relation) {
    const family = socialRelationFamily(clean(relation, NAME_MAX));
    const tags = [];
    if (ALLY_FAMILIES.has(family)) tags.push('ally');
    if (RIVAL_FAMILIES.has(family)) tags.push('rival');
    if (OWES_FAMILIES.has(family)) tags.push('owes');
    return ordered(tags);
}
