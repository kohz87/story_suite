// Which conditions still hold: a timed one ends at its recorded minute; `treated` holds until `~ condition ... cleared`.

/** The story minute a state holds (the Director's clock), or null when there is none. */
export function minutesOf(state) {
    const minutes = state?.domains?.director?.time?.minutes;
    return Number.isInteger(minutes) ? minutes : null;
}

/** The member's conditions that have not expired at `now` (all of them when the time is unknown). */
export function liveConditions(member, now) {
    return (member?.conditions ?? []).filter(item => item.until === 'treated' || !Number.isInteger(now) || item.until > now);
}
