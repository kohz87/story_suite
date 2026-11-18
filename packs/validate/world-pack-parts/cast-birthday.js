// The job: checking a format 4 world cast entry's `birthday`: "<month number or name> <day>", like "10 27" or "Icewane 27". Shape only:
// the month and the day count belong to the calendar of the paired game pack (checkPairing, a later job); a month that does not resolve there drops the birthday.

const SHAPE = /^(\d{1,2}|\p{L}[\p{L}'’ -]{0,39}) (\d{1,3})$/u;

/** → the kept text `"<month> <day>"` (spaces collapsed), or undefined after `say('birthday', …)`. */
export function checkBirthday(value, say) {
    const text = typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : '';
    const match = SHAPE.exec(text);
    const month = match && /^\d+$/.test(match[1]) ? Number(match[1]) : null;
    if (!match || month === 0 || Number(match[2]) < 1) return say('birthday', 'birthday must be a month (its number or its name) and a day, like "10 27" or "Icewane 27".'), undefined;
    return text;
}
