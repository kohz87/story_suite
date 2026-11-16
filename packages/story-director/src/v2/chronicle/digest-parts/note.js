// Story Director v2, chronicle part: the note command that keeps each reply's day facts and quest history, and the hook that asks for it. Pure apart from the ctx.

import { FOLD_AT, QUEST_LOG_KEPT, QUEST_LOG_TEXT, cut, dayOf, entriesByDay, foldEntries, notedOf } from '../days.js';
import { questLogOrder } from '../days-parts/quest-log-order.js';
import { toSlot } from '../../slot.js';
import { ask, digestOn, isInt, minutesFrom } from './shared-ask.js';

export const NOTE = 'chronicle.note';

// This note's own receipt ID: where the next note starts reading (`noted.through`), when the host gives one.
const ownId = ctx => (typeof ctx.receiptId === 'string' && /^[A-Za-z][\w-]{0,63}$/.test(ctx.receiptId) ? ctx.receiptId : null);
const throughOf = value => (typeof value?.through === 'string' ? { through: value.through } : {});

/**
 * `chronicle.note {}` (cause `system`, from the hook): keeps what the receipts committed since the last
 * note hold: by day, as entries of their own (`chronicle.dayFacts["<day>.<rev>"]`, `rev` this receipt's;
 * only while the digest feature is on), and the quest history (`chronicle.questLog`, always), and
 * records where it got to (`chronicle.noted`). A day already holding FOLD_AT entries has them folded
 * into this note's one (theirs removed). Refused from a click.
 * It reads from the last note's own receipt (`noted.through`, in chat order), so a Re-read that renumbers the receipts
 * never makes it read again what an earlier note kept, nor take a reply's receipts that an earlier note passed. Known
 * limit: what an edited reply's Re-read adds is not kept either (its kept note replays as stored).
 */
export function noteCommand(ctx) {
    if (ctx?.cause === 'ui') return ctx.fail('REFUSED', 'Day facts are kept by Story Director itself.');
    const query = typeof ctx.query === 'function' ? (name, args) => ctx.query(name, args) : null;
    const chronicle = ctx.draft('chronicle');
    const isMap = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
    if (!isMap(chronicle.dayFacts)) chronicle.dayFacts = {};
    if (!isMap(chronicle.questLog)) chronicle.questLog = {};
    const before = notedOf(chronicle);
    const now = minutesFrom(query);
    const on = digestOn(ctx);
    // Where the day facts stopped while the digest was off (`gap`): back on, the note reads from there.
    // The quest history read again from there adds what it holds already (the same keys and texts).
    const gap = isMap(before?.gap) ? before.gap : null;
    // `present`: the scene the last note left (who was there for the lines of the receipts that follow).
    const after = on && gap ? { after: gap.rev, ...throughOf(gap), minutes: gap.minutes, present: before?.present } : { after: before ? before.rev : null, ...throughOf(before), minutes: before ? before.minutes : null, present: before?.present };
    const plan = ask(query, 'chronicle.noteFacts', after) ?? { entries: [], settle: null };
    const rev = isInt(ctx.rev) ? ctx.rev : 0;
    // The quest history: each receipt that touched a quest or thread, by its revision; the newest few
    // per thread stay (older ones removed by key).
    const touched = new Set();
    for (const item of plan.quests ?? []) {
        if (!isInt(item?.rev) || typeof item.thread !== 'string' || !/^[A-Za-z0-9_.:-]{1,64}$/.test(item.thread)) continue;
        const said = cut(String(item.text ?? '').replace(/^Director: /, ''), QUEST_LOG_TEXT);
        if (!said) continue;
        chronicle.questLog[String(item.rev)] = { thread: item.thread, text: said };
        touched.add(item.thread);
    }
    for (const thread of touched) {
        const keys = Object.entries(chronicle.questLog).filter(([, entry]) => entry?.thread === thread).sort(questLogOrder).map(([key]) => key);
        for (const key of keys.slice(0, Math.max(0, keys.length - QUEST_LOG_KEPT))) delete chronicle.questLog[key];
    }
    const byDay = entriesByDay(chronicle);
    const kept = [];
    // The day facts only while the digest is on.
    for (const { day, entry } of on ? plan.entries ?? [] : []) {
        if (!isInt(day) || !entry || entry.count <= 0) continue;
        const earlier = byDay.get(day) ?? [];
        let own = entry;
        // A very long day: its entries become this one (each removed by its key).
        if (earlier.length >= FOLD_AT) {
            own = foldEntries([...earlier.map(item => item.entry), entry], day);
            for (const item of earlier) delete chronicle.dayFacts[item.key];
        }
        chronicle.dayFacts[`${day}.${rev}`] = own;
        kept.push(day);
    }
    const firstDay = isInt(now) ? dayOf(now) : null;
    const mark = ownId(ctx);
    chronicle.noted = toSlot({
        rev,
        ...(mark ? { through: mark } : {}),
        minutes: isInt(now) ? now : before?.minutes ?? null,
        // The first day a note saw the clock on (a note before the clock was set leaves it to a later one).
        from: before && isInt(before.from) ? before.from : firstDay,
        settle: plan.settle ?? before?.settle ?? null,
        ...((Array.isArray(plan.present) ? plan.present : before?.present ?? []).length ? { present: Array.isArray(plan.present) ? plan.present : before.present } : {}),
        ...(on ? {} : { gap: gap ?? { rev: before ? before.rev : null, ...throughOf(before), minutes: before ? before.minutes : null } }),
    });
    return { summary: '', narrate: false, data: { days: kept } };
}

/**
 * The hook's note: `[{ type: chronicle.note }]` when something was committed since the last note. By revision; once a
 * Re-read has left fewer revisions than the last note's, by asking whether any receipt comes after that note.
 */
export function noteCommands(view) {
    const chronicle = view?.state?.domains?.chronicle;
    if (!chronicle) return [];
    const rev = view.state.meta?.rev;
    const noted = notedOf(chronicle);
    if (!isInt(rev)) return [];
    if (noted && noted.rev >= rev) {
        const query = typeof view.query === 'function' ? (name, args) => view.query(name, args) : null;
        if (typeof noted.through !== 'string' || ask(query, 'chronicle.noteFacts', { through: noted.through, after: noted.rev })?.fresh !== true) return [];
    }
    return [{ type: NOTE, payload: {} }];
}
