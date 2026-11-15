// Pack events, shared keys: the fire command's name, the caps, and the claim keys of a once and a repeating event.

/** The internal command a due event is committed through. */
export const FIRE = 'events.fire';

export const EVENT_LIMITS = Object.freeze({ id: 120, cue: 500, then: 8, events: 500 });

export const claimKey = id => `event:${id}`;

// A repeating event's claim for one reply (`at` = the index of the reply being written; a swipe or a
// regenerate writes the same index again, so it does not pay again): once per reply.
export const repeatKey = (id, at) => `event:${id}:${at}`;
