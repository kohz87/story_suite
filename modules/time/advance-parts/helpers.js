// The plain-words span of minutes and the once-per-reply claim key of a clock move.

/** "2 h", "45 min", "1 h 30 min". */
export function spanText(minutes) {
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return [hours ? `${hours} h` : '', rest ? `${rest} min` : ''].filter(Boolean).join(' ') || '0 min';
}

/** The claim one reply's move for `cause` takes, or null without a reply to key on. */
export const advanceClaim = (cause, sid) => (typeof sid === 'string' && sid ? `advance:${cause}:${sid}` : null);
