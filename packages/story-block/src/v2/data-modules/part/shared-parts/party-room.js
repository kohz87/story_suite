// Counts the party from the domain's own blocks and refuses a join when there is no room.
import { refuse } from '../../interpreter.js';
import { activeDefinition, instanceOf } from '../../adapters.js';
import { oneLine } from '../../../../../../../core/text.js';
import { fill } from '../../../../../../../core/strings.js';
import { PARTY_ACTIVE, PARTY_MAX } from '../../../lean-rpg/names.js';
import { B } from './texts.js';

// (the party is read from this domain's own blocks, never from the lazy RPG library: a chat with the RPG off must replay the same witness; it is lean-rpg/join.js partyOf's
// [module, left] pairs, a chat-scope Character with a name)
const partyPairs = state => {
    const out = [], active = state?.domains?.dataModules?.active;
    for (const module of Object.keys(active !== null && typeof active === 'object' ? active : {})) {
        const definition = activeDefinition(state, module);
        if (definition?.role !== 'character' || definition.scope !== 'chat') continue;
        const fields = instanceOf(state, module)?.fields;
        if (fields === null || typeof fields !== 'object' || Array.isArray(fields)) continue;
        if (oneLine(fields.who) || oneLine(definition.name)) out.push([module, fields.left === true]);
    }
    return out;
};
// The only thing a join, creation or return relied on from the party: was there room (fewer than the limit in force active) before it. Replay witnesses just this boolean,
// so removing an unrelated earlier member below the cap leaves later members as they were.
const partyRoomOf = (state, limit = PARTY_MAX) => partyPairs(state).filter(pair => !pair[1]).length < limit;
const partyFull = (ctx, prefix) => {
    if (ctx.cause === 'ui' && !partyRoomOf(prefix, PARTY_ACTIVE)) refuse('REFUSED', '', fill(B.partyFull, { max: PARTY_ACTIVE }));
};

export { partyPairs, partyRoomOf, partyFull };
