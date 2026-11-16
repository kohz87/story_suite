// The party witness a join records and the active limit it stands for.
import { DM_OLD_ROOM, dmRoom } from '../../schema.js';
import { PARTY_ACTIVE, PARTY_MAX } from '../../../rpg/names.js';

// Every way a Character joins or comes back (a story `+ party` / `- party` line, the reader's Add to party, the wizard's and the template's Character) records the
// party it relied on and keeps the active limit (4, or 8 on a reply with only the `partyRoom` mark): `partyWitness` says a guard records it (a story reply from before the `partyRoom` mark does not), `partyFull` refuses live.
// The value is what the guard records as `selector.party`: PARTY_ACTIVE (a story reply with the `partyFour` mark) when the 4-active limit is in force,
// `true` for a reply with only the `partyRoom` mark (8 active), PARTY_ACTIVE for the reader's own actions (they follow the current rule), false for an older reply.
const partyWitness = ctx => (ctx.cause === 'ui' ? PARTY_ACTIVE : ctx.carrier?.rules?.includes('partyFour') ? PARTY_ACTIVE : ctx.cause === 'story' && dmRoom(ctx) !== DM_OLD_ROOM);
// The active limit that witness stands for (a story reply from before `partyRoom` has none: the old count in checkJoin).
const partyLimit = witness => (witness === PARTY_ACTIVE ? PARTY_ACTIVE : PARTY_MAX);

export { partyWitness, partyLimit };
