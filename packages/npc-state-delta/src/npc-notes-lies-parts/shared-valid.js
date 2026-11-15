// Field checks shared by the lie parts: a valid reply key, story day and text.

export const replyOk = value => (typeof value === 'string' && value.length > 0 && value.length <= 80) || (Number.isSafeInteger(value) && value >= 0);
// A story day is null when the story has no clock (clockDay in npc-meters.js).
export const dayOk = value => value === null || (Number.isSafeInteger(value) && value >= 0);

export const text = (value, max) => typeof value === 'string' && value.length > 0 && [...value].length <= max;
