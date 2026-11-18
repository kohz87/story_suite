// A sample for Settings › People › People in this chat (the harness's `roster` view): the shared cast, as the store's people list gives it.
import { PEOPLE } from './people.js';

/** One entry for each person of the shared cast: whether they are in the scene, followed, dormant or deceased. */
export const ROSTER = {
  people: PEOPLE.cast.map(p => ({ id: p.personId, name: p.name, present: p.at === 'here', followed: p.followed === true, dormant: false, deceased: false })),
};
