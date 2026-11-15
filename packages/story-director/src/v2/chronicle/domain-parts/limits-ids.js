// Chronicle's id patterns and the states an event can be in.

export const EVENT_ID = /^ev_[0-9a-z]{8}$/;
export const FACTION_ID = /^fa_[0-9a-z]{8}$/;

/** The states an event can be in; looming and ongoing are open. */
export const STATES = Object.freeze(['looming', 'ongoing', 'resolved']);
export const OPEN_STATES = Object.freeze(['looming', 'ongoing']);
