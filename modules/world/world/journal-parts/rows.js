// Story Director v2, journal: builds the rows of a day's relationship, item and event folds.

import { isInt } from './shared-helpers.js';
import { UPKEEP_TEXT } from './upkeep.js';
import { wordEnd, same, plain } from './row-text.js';

const ARROW = /^(\S+) (.+?) (?:->|→) (.+)$/;
const LOST = /^Lost (.+?)(?: x(\d+))? \((\d+) left\)\.?$/;

// "Torka: affection 9 -> 10, desire 7 -> 8 (held at 7)" → one row per person, its meter changes as tags (a meter moved twice: first from, last to).
export function relationRows(lines, display = false) {
    const rows = new Map();
    const loose = [];
    const named = new Set();
    for (const line of lines) {
        const at = line.indexOf(': ');
        const name = at > 0 ? line.slice(0, at) : '';
        const moves = (at > 0 ? line.slice(at + 2) : line).replace(/\([^)]*\)/g, '').split(',').map(part => ARROW.exec(part.trim())).filter(Boolean);
        if (!name || !moves.length) { loose.push({ line, name }); continue; }
        named.add(name.toLowerCase());
        const row = rows.get(name.toLowerCase()) ?? { ...plain(''), title: name, meters: new Map() };
        rows.set(name.toLowerCase(), row);
        for (const [, meter, from, to] of moves) row.meters.set(meter, { from: row.meters.get(meter)?.from ?? from, to: to.replace(/[\s.]+$/, '') });
    }
    // On the screen a meter that ended where it began (7 → 8, then 8 → 7) did not move; a person whose meters all ended so has no row.
    // On the screen only: a person with a row (even one dropped for that) has no second, loose line, and an upkeep line ("nothing changed") is none.
    const fit = display ? wordEnd : same;
    const rest = loose.filter(item => !display || (!named.has(item.name.toLowerCase()) && !UPKEEP_TEXT.test(item.line.trim()))).map(item => plain(item.line, fit));
    const shown = [...rows.values()].map(({ meters, ...row }) => ({ ...row, tags: [...meters].filter(([, move]) => !display || move.from !== move.to).map(([meter, move]) => `${meter} ${move.from} → ${move.to}`) }));
    return (display ? shown.filter(row => row.tags.length) : shown).concat(rest);
}

// A day's repeated "Lost X xN (n left)" lines are one: "Lost: A x36, B x12" (the counts of one item add up; a lone one stays as it was).
export function itemRows(lines, fit = same) {
    const lost = lines.map(line => LOST.exec(line)).filter(Boolean);
    if (lost.length < 2) return lines.map(line => plain(line, fit));
    const total = new Map();
    for (const [, name, count] of lost) total.set(name, (total.get(name) ?? 0) + (count ? Number(count) : 1));
    const merged = [...total].map(([name, count]) => (count > 1 ? `${name} x${count}` : name));
    return [...lines.filter(line => !LOST.test(line)).map(line => plain(line, fit)), plain(`Lost: ${merged.join(', ')}`, fit)];
}

// Events: one row per thread (a quest or thread the lines or the stamps name): its latest line, "N steps today", and "began <date>" on the day it ends.
export function eventRows(day, events, { threads, format, fit = same }) {
    const groups = new Map();
    const rows = [];
    for (const { line, thread, who } of events) {
        const known = thread ? threads.get(thread) : null;
        const title = known ? String(known.key ?? '') : '';
        if (!title || day.hide(title)) { rows.push({ ...plain(line, fit), ...whoOf(who), order: rows.length }); continue; }
        const key = title.toLowerCase();
        const group = groups.get(key) ?? { title, lines: [], thread: known, order: rows.length };
        if (!groups.has(key)) rows.push(group);
        groups.set(key, group);
        group.lines.push(line);
        group.who = who;
    }
    const stamps = [['taken', 'began'], ['done', 'finished'], ['failed', 'failed'], ['dropped', 'gave up']];
    for (const [list, chip] of stamps) {
        for (const title of day.quests[list] ?? []) {
            if (day.hide(title)) continue;
            const key = String(title).toLowerCase();
            const group = groups.get(key) ?? { title, lines: [], thread: [...threads.values()].find(item => String(item?.key ?? '').toLowerCase() === key) ?? null };
            if (!groups.has(key)) { groups.set(key, group); rows.push(group); }
            group.chip = list === 'taken' && group.chip ? group.chip : chip;
        }
    }
    return rows.map(row => {
        if (!row.lines) return { ...plain(''), detail: row.detail, ...whoOf(row.who) };
        const ends = ['finished', 'failed', 'gave up'].includes(row.chip);
        const began = ends && isInt(row.thread?.taken?.at) && typeof format === 'function' ? format(row.thread.taken.at) : '';
        const since = began && dayOfMinutes(row.thread.taken.at) !== day.day ? `began ${began}` : '';
        const stepsLabel = row.lines.length > 1 ? `${row.lines.length} steps today` : '';
        return { ...plain(row.lines.at(-1) ?? '', fit), title: row.title, chip: row.chip || 'step', note: [stepsLabel, since].filter(Boolean).join(' · '), since, stepsLabel, steps: row.lines.length > 1 ? row.lines.map(fit) : [], ...whoOf(row.who) };
    });
}

// A row's witnesses (the people there for its latest line), only when it has any, so a day without them is as it was.
const whoOf = who => (Array.isArray(who) && who.length ? { who } : {});
const dayOfMinutes = minutes => Math.floor(minutes / 1440);
