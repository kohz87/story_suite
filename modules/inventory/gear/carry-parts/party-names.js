// The names a mount's `where` can call the party by: every current member's (the reader's character among them) and, for display, the reader's persona.

import { membersOf } from '../../validate-parts/party.js';

/**
 * The current members (`party.actors`, else the `party` domain: validate-parts/party.js; someone who left is on neither), then the reader's persona
 * (`persona.name`), without repeats. `query(name, args)` answers the host's queries; `party` is the `party` domain or null.
 * `persona: false`: only the names held in the chat's state, for judging a story line (the persona is read live, so a rename would
 * change what a Re-read decides).
 */
export function partyNames(query, party, { persona: withPersona = true } = {}) {
    const ask = (name, args) => { try { return query(name, args); } catch { return null; } };
    let members = [];
    try { members = membersOf(ask, party).filter(member => member.name !== member.id).map(member => member.name); } catch { members = []; }
    const persona = withPersona ? ask('persona.name') : null;
    return [...new Set([...members, typeof persona === 'string' ? persona.trim() : ''].filter(Boolean))];
}
