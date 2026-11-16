// Story Director v2, journal: the days not written yet (the day under way, a day just ended), as their digests will be written.

import { boardDay } from '../../chronicle/queries.js';
import { dayOf, digestOut, entriesByDay, factsOf, makeDigest, notedOf, rangeDays } from '../../chronicle/days.js';
import { queryOf, tryQuery } from '../known.js';
import { isRecord, isInt, substituteOf } from './shared-helpers.js';

// The days not written yet (the day under way, and a day just ended whose digest the next reply writes),
// from the day-facts entries kept for them and the receipts since the last note (`chronicle.noteFacts`,
// what the next note will keep): as their digests will be written. `written`: the days the board has.
export function pending(state, tools, { calendar, now, written }) {
    const chronicle = state?.domains?.chronicle;
    const byDay = entriesByDay(chronicle);
    const fresh = new Map();
    const noted = notedOf(chronicle);
    const plan = tryQuery(queryOf(tools), 'chronicle.noteFacts', { after: isInt(noted?.rev) ? noted.rev : null, ...(typeof noted?.through === 'string' ? { through: noted.through } : {}), minutes: isInt(noted?.minutes) ? noted.minutes : null, ...(Array.isArray(noted?.present) ? { present: noted.present } : {}) }, null);
    for (const item of Array.isArray(plan?.entries) ? plan.entries : []) {
        if (!isInt(item?.day) || !isRecord(item.entry) || !(item.entry.count > 0)) continue;
        if (!fresh.has(item.day)) fresh.set(item.day, []);
        fresh.get(item.day).push(item.entry);
    }
    const days = [...new Set([...byDay.keys(), ...fresh.keys()])].filter(day => !written.has(day) && (!isInt(now) || day <= dayOf(now))).sort((a, b) => b - a);
    if (!days.length) return [];
    const dayOfRev = rangeDays(byDay);
    const currency = tryQuery(queryOf(tools), 'inventory.currency', {}, null);
    const out = [];
    for (const day of days) {
        const entries = [...(byDay.get(day) ?? []).map(item => item.entry), ...(fresh.get(day) ?? [])];
        const facts = factsOf(entries, { state, day, dayOfRev });
        if (!facts.count) continue;
        let date = '';
        try { date = calendar.format(day * 1440, { time: false }); } catch { date = ''; }
        const digest = makeDigest(day, facts, { date, currency, revs: facts.revs });
        out.push({ ...boardDay(digestOut(digest, { currency, substitute: substituteOf(tools) })), today: isInt(now) && day === dayOf(now) });
    }
    return out;
}
