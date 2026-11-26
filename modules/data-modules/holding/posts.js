// The holding's officer posts as the state holds them: the six posts, who travels with You, and the posts a rejoin has ended. Pure.
import { activeDefinition, instanceOf } from '../adapters.js';
import { fold, readSheet, sameWho } from '../../rpg/read.js';
import { isHolding } from './read.js';

/** Each post's field and the words it is shown in; a holding's definition may lack them (then it has no posts). */
export const POSTS = Object.freeze({ steward: 'steward', marshal: 'marshal', spymaster: 'spymaster', healer: 'healer/chaplain', quartermaster: 'quartermaster', envoy: 'envoy' });

/** Whether the person is a party member who has not left: they travel with You. */
export function travels(state, name) {
    const party = readSheet(state, { withLeft: true }).characters;
    return party.some(member => !member.left && sameWho(member, name, [], party));
}

/** The posts these fields give the person of that name. */
export const postsOf = (fields, name) => Object.keys(POSTS).filter(post => fields?.[post] && fold(fields[post]) === fold(name));

/** The posts whose holder travels with You again, as `[{ module, posts }]`, one entry for each pinned holding that has any. */
export function lapsedPosts(state) {
    return Object.keys(state?.domains?.dataModules?.active ?? {}).flatMap(module => {
        if (!isHolding(activeDefinition(state, module))) return [];
        const fields = instanceOf(state, module)?.fields;
        const posts = Object.keys(POSTS).filter(post => fields?.[post] && travels(state, fields[post]));
        return posts.length ? [{ module, posts }] : [];
    });
}
