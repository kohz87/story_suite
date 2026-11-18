// The party limits the view shows: PARTY_ACTIVE is the active limit the engine holds a party to ("3/4", the Party tab's Invite), the RPG's PARTY_ACTIVE;
// PARTY_LISTED is how many members the Party tab lists at most, the RPG's PARTY_MAX (a reply from before the `partyFour` mark may hold up to 8 active).
// Both mirror modules/rpg/names-parts/party.js, kept here so the view does not import a module.
export const PARTY_ACTIVE = 4;
export const PARTY_LISTED = 8;
