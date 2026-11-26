// The names a mount's `where` can call the party by: the reader's own and every current member's.

import { membersOf } from '../../validate-parts/party.js';

/**
 * The current members (`party.actors`, else the `party` domain: validate-parts/party.js; someone who left is on neither), then the reader's persona
 * (`persona.name`), without repeats. `query(name, args)` answers the host's queries; `party` is the `party` domain or null.
 */
export function partyNames(query, party) {
    const ask = (name, args) => { try { return query(name, args); } catch { return null; } };
    let members = [];
    try { members = membersOf(ask, party).filter(member => member.name !== member.id).map(member => member.name); } catch { members = []; }
    const persona = ask('persona.name');
    return [...new Set([...members, typeof persona === 'string' ? persona.trim() : ''].filter(Boolean))];
}
