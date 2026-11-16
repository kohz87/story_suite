// Reads the ambush drop carried from one reply's receipt to the next reply's roll.

/**
 * The ambush a roll with no fight left for the next reply (A2): a successful ambush check made in a reply whose roll had no acts is spent once, on the very
 * next reply's roll that has acts. The pre-call reads it from the previous reply's receipt (`drop: true` in its `result.ambush`) into the payload, so a replay
 * rolls with what the payload recorded. → `{ who, skill, total, dc }` or null (a damaged value is no ambush).
 */
export function carriedFrom(value) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
    const { who, skill, total, dc } = value;
    if (typeof who !== 'string' || !who || who.length > 60 || !(skill === null || (typeof skill === 'string' && skill.length <= 60)) || !Number.isSafeInteger(total) || !Number.isSafeInteger(dc)) return null;
    return { who, skill, total, dc };
}
/** The drop a previous roll's record left (`result.ambush` of a reply with no fight in it), as `carriedFrom` takes it, or null. */
export function dropOf(result) {
    const ambush = result?.ambush;
    return ambush && ambush.success === true && ambush.drop === true && ambush.carried !== true ? carriedFrom({ who: ambush.who, skill: ambush.skill ?? null, total: ambush.total, dc: ambush.dc }) : null;
}
