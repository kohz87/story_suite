// What a reader edit witnesses for replay: the target stack, its pieces, and the add and rename decisions.

import { cleanName, trimText, resolveDef, slugify } from '../../scene/names.js';
import { condOf, MAX_NOTE } from '../state.js';
import { looseMatch, stacksOf, freeId } from '../stacks.js';

export const editStack = stack => ({ id: stack.id, def: stack.def, owner: stack.owner });
export const editPieces = (inventory, target) => Object.values(inventory?.stacks ?? {})
    .filter(stack => stack.def === target.def && stack.owner === target.owner)
    .map(stack => ({ id: stack.id, equipped: stack.equipped }));

// Saved ops cannot choose a different stack on replay. Witness the same name lookup and
// compatibility decision made when the reader added or renamed an item, without including
// unrelated inventory or a destination count that counter replay can safely rebase.
const editCompatibility = (inv, stack) => stack ? {
    id: stack.id, def: stack.def, owner: stack.owner, note: stack.note,
    equipped: stack.equipped, condition: condOf(stack, inv), key: stack.key === true,
} : null;
export function addDecision(inv, payload, defId) {
    const name = cleanName(payload.name), owner = payload.owner ?? 'party';
    const note = payload.note == null ? '' : trimText(payload.note, MAX_NOTE);
    const def = inv.defs[defId];
    const destination = def?.stack ? looseMatch(inv, defId, owner, note) : null;
    return { resolution: resolveDef(inv, name), def: def ? { id: def.id, stack: def.stack } : null,
        destination: editCompatibility(inv, destination) };
}
// `withStory` (a rename saved now carries `decision.story: 1`): the witness also holds whether the stack merged into is the story's, since the merge sets the
// result's "from the story" flag from both stacks. A rename saved before has no such mark and is witnessed as it was.
export function renameDecision(inv, stack, payload, withStory = false) {
    const name = cleanName(payload.name), original = inv.defs[stack.def], found = resolveDef(inv, name);
    const note = payload.note === undefined ? stack.note : payload.note == null ? '' : trimText(payload.note, MAX_NOTE);
    const source = { ...editCompatibility(inv, stack), note };
    if (found.status === 'found' && found.id !== original.id) {
        const targetDef = inv.defs[found.id];
        const target = stacksOf(inv, found.id).find(other => targetDef.stack && source.owner === other.owner
            && source.equipped === other.equipped && source.note === other.note && source.condition === condOf(other, inv)
            && source.key === (other.key === true));
        return { resolution: found, original: { name: original.name, stack: original.stack }, source,
            sourceQty: stack.qty, sourceStory: stack.story === true, targetStackable: targetDef.stack,
            destination: editCompatibility(inv, target), ...(withStory ? { destinationStory: target?.story === true } : {}) };
    }
    if (name === original.name) return { resolution: found, original: { name: original.name, stack: original.stack } };
    const shared = Object.values(inv.stacks).some(other => other.id !== stack.id && other.def === original.id);
    if (shared || original.id.startsWith('pack.')) {
        return { resolution: found, original, shared, newDef: freeId(inv, `story/${slugify(name)}`) };
    }
    const aliases = Object.keys(inv.aliases).filter(key => inv.aliases[key] === original.id).sort();
    return { resolution: found, original: { name: original.name, stack: original.stack }, shared, aliases };
}
