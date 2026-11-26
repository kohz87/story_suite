// The holding's officer posts as the state holds them: the six posts, who holds which, and the posts a rejoin or a death has ended. Pure.
import { activeDefinition, instanceOf } from '../adapters.js';
import { fold } from '../../rpg/read.js';
import { isHolding } from './read.js';
import { isDead, travels } from './person.js';

/** Each post's field and the words it is shown in; a holding's definition may lack them (then it has no posts). */
export const POSTS = Object.freeze({ steward: 'steward', marshal: 'marshal', spymaster: 'spymaster', healer: 'healer/chaplain', quartermaster: 'quartermaster', envoy: 'envoy' });

/** The posts these fields give the person of that name. */
export const postsOf = (fields, name) => Object.keys(POSTS).filter(post => fields?.[post] && fold(fields[post]) === fold(name));

/** The posts whose holder has died or travels with You again, as `[{ module, posts, dead }]` (`dead`: those of them whose holder died), one entry for each pinned holding that has any. */
export function lapsedPosts(state) {
    return Object.keys(state?.domains?.dataModules?.active ?? {}).flatMap(module => {
        if (!isHolding(activeDefinition(state, module))) return [];
        const fields = instanceOf(state, module)?.fields;
        const held = Object.keys(POSTS).filter(post => fields?.[post]);
        const dead = held.filter(post => isDead(state, fields[post]));
        const posts = held.filter(post => dead.includes(post) || travels(state, fields[post]));
        return posts.length ? [{ module, posts, dead }] : [];
    });
}
