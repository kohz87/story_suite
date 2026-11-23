// What one reply rolled, read from that reply's own receipts (never from the live state): its `? try` rolls with what each cost and taught, the practice of its
// `~ spend` lines, its xp, the foes it set up or ended, the lessons it taught and the matchup it was written under. A pure read, so a swipe, a reload and a rebuild show the same.

import { practiceKey } from './practice.js';
import { diceBefore } from './dice-source.js';
import { threatShort } from './matchup.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const of = (list, type, index) => (Array.isArray(list) ? list : []).filter(entry => entry?.index === index && entry.receipt?.type === type && isRecord(entry.receipt.data)).map(entry => entry.receipt.data);

/**
 * `{ rolls, spends, xp, lessons, foes, matchup }` for the reply at message `index`; `entries` are `store.receipts()` as a query's tools give them, `nameOf(memberId)` the name to say.
 * A roll: { who, target, die, bonus, total, difficulty, band, quality, raised, why, edge?, edgeWhy?, unlearned, paid, practice, rankUp }. A spend: { who, skill, practice, rankUp, sessions?, asked?, days? } only where it taught
 * something and the reply did not roll that skill (a roll for the skill in the reply wins, but not over training sessions of 2 or more). xp: [{ summary, amount, levels }]. lessons: [{ who, skill, practice, rankUp }]. foes: [{ name, count, threat (a word), reinforcements, ended }]. matchup: { band, why } or null.
 */
export function rollsOf(entries, index, nameOf = id => id) {
    const rolls = of(entries, 'capture.try', index).map(data => ({
        who: nameOf(data.member), target: String(data.target ?? ''), die: data.die, bonus: data.bonus ?? 0, total: data.total, difficulty: data.difficulty ?? 1, band: data.band, quality: typeof data.quality === 'string' ? data.quality : '', raised: data.raised === true, unlearned: data.unlearned === true,
        edge: Number.isInteger(data.edge) && !data.edgeIgnored && data.edge !== 0 ? { steps: data.edge, why: String(data.edgeWhy ?? '') } : null,
        why: Array.isArray(data.why) ? data.why.map(String) : [], paid: data.paid ?? 'none', practice: Number.isInteger(data.practice) ? data.practice : 0, rankUp: data.rankUp ?? null,
    }));
    const rolled = new Set(rolls.map(roll => `${roll.who}\u0000${practiceKey(roll.target)}`));
    const spends = [...of(entries, 'capture.spend', index), ...of(entries, 'capture.train', index)]
        .map(data => ({ who: nameOf(data.member), skill: String(data.skill ?? ''), practice: Number.isInteger(data.practice) ? data.practice : 0, rankUp: data.rankUp ?? null, ...(data.sessions > 1 || data.asked > 1 ? { sessions: data.sessions, asked: data.asked, days: data.days } : {}) }))
        .filter(spend => spend.practice > 0 && (spend.sessions > 1 || !rolled.has(`${spend.who}\u0000${practiceKey(spend.skill)}`)));
    const xp = (Array.isArray(entries) ? entries : []).filter(entry => entry?.index === index && entry.receipt?.type === 'capture.xp' && isRecord(entry.receipt.data))
        .map(({ receipt }) => ({ summary: String(receipt.summary ?? ''), amount: receipt.data.amount ?? 0, levels: receipt.data.levels ?? 0 }));
    const lessons = of(entries, 'capture.lesson', index).map(data => ({ who: nameOf(data.member), skill: String(data.skill ?? ''), practice: Number.isInteger(data.practice) ? data.practice : 0, rankUp: data.rankUp ?? null }));
    const foes = of(entries, 'capture.foes', index).map(data => ({ name: String(data.name ?? ''), count: data.count ?? data.ended ?? 0, threat: threatShort(data.threat), reinforcements: data.reinforcements === true, ended: Number.isInteger(data.ended) }));
    return { rolls, spends, xp, lessons, foes, matchup: diceBefore(index, Array.isArray(entries) ? entries : [])?.matchup ?? null };
}
