// What the narrator is told about the holding's posts: who holds them (in the holding's tail line), how to give or free one, and the spymaster's
// warning. The two post lines are taught here, not in the static prompt, and only once there is a seat and someone who could be staying behind.
import { readSheet } from '../../rpg/read.js';
import { samePlace } from '../../cast/cast/entries-parts/places.js';
import { POSTS } from './posts.js';

const holders = fields => Object.keys(POSTS).filter(post => fields[post]);

/** "posts: steward Mira, marshal Oren", or '' when none is held. */
export const postsPart = fields => (holders(fields).length ? `posts: ${holders(fields).map(post => `${POSTS[post]} ${fields[post]}`).join(', ')}` : '');

// A post is held, a companion has left the party, or the cast has someone staying at the seat: read from the state alone.
const inPlay = (state, fields) => holders(fields).length > 0
    || readSheet(state, { withLeft: true }).characters.some(member => member.left)
    || Object.values(state?.domains?.cast?.people ?? {}).some(person => samePlace((Array.isArray(person?.base) ? person.base[0] : person?.base)?.at, fields.seat));

/** The tail lines about posts for a founded holding's fields (null: none founded); `reference`: the module's name on a `dm` line. */
export function postLines(state, fields, reference) {
    if (!fields?.seat || fields.steward === undefined || !inPlay(state, fields)) return [];
    const lines = [`Posts, one each, for someone not travelling with You who stays at the seat: ~ dm ${reference} — reason | kind: post | post: ${Object.keys(POSTS).join('|')} | who: Name. To free one: ~ dm ${reference} | kind: unpost | post: ….`];
    if (fields.spymaster) lines.push(`Spymaster ${fields.spymaster}: before an assassin's contract (the Hand's too) or a rival's move against the holding strikes, show ${fields.spymaster}'s warning reaching the player.`);
    return lines;
}

/** Tail room, in tokens: for the lines above (`state` given), else for the posts in the holding's own line. */
export function postRoom(fields, state = null) {
    if (state) return Math.ceil(postLines(state, fields, fields?.module ?? '').join('\n').length / 4);
    return holders(fields ?? {}).length ? Math.ceil((postsPart(fields).length + 2) / 4) : 0;
}
