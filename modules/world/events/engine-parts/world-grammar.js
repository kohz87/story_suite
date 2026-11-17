// World events, the strict grammar of the pack-author spec §3 for numbers and times: durations, chances, odds multipliers.
// Each parser gives `{ value }` or `{ why }` (a sentence for the author); none of them reads the story.

const SEASON_DAYS = 90;
const UNIT_DAYS = Object.freeze({ day: 1, days: 1, week: 7, weeks: 7, season: SEASON_DAYS, seasons: SEASON_DAYS });
const MAX_DAYS = 3650;
const UNTIL_CLEARED = 'until cleared';

/** "10 days", "1 season", "2 weeks" → `{ days, text }`; `until cleared` only where `open` allows it (→ `{ days: null }`). */
export function parseDuration(raw, { open = false } = {}) {
    const text = typeof raw === 'string' ? raw.trim() : '';
    if (open && text === UNTIL_CLEARED) return { value: { days: null, text } };
    const match = /^(\d{1,4}) (days?|weeks?|seasons?)$/.exec(text);
    const days = match ? Number(text.split(' ')[0]) * UNIT_DAYS[match[2]] : 0;
    if (!match || !(days >= 1) || days > MAX_DAYS) return { why: `"${text || raw}" is not a duration; write a number and a unit such as "10 days", "2 weeks" or "1 season"${open ? ', or "until cleared"' : ''}.` };
    return { value: { days, text } };
}

/** "20% over the window" / "30% per season" → `{ percent, per: 'window' | 'season' }`. */
export function parseChance(raw) {
    const match = typeof raw === 'string' ? /^(\d{1,3}(?:\.\d{1,2})?)% (over the window|per season)$/.exec(raw.trim()) : null;
    const percent = match ? Number(match[1]) : NaN;
    if (!match || !(percent >= 0 && percent <= 100)) return { why: `chance ${JSON.stringify(raw)} must read "20% over the window" or "30% per season" (0 to 100%).` };
    return { value: { percent, per: match[2] === 'per season' ? 'season' : 'window' } };
}

/** "×2", "×0.5", "×0" → a number from 0 to 100. A percent, a bare number or an ASCII "x" is refused. */
export function parseMultiplier(raw) {
    const match = typeof raw === 'string' ? /^×(\d{1,3}(?:\.\d{1,3})?)$/.exec(raw.trim()) : null;
    const number = match ? Number(match[1]) : NaN;
    if (!match || !(number >= 0 && number <= 100)) return { why: `${JSON.stringify(raw)} is not an odds multiplier; write ×N such as "×2", "×0.5" or "×0" (not a percent).` };
    return { value: number };
}
