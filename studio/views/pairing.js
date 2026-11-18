// The Pairing page (views/route.js PAGES; a part in the Check group while a world pack is open; mock MK-6): the world against the open
// game pack or the Built-in game, through studio/pairing.js (each pack's own check first, then the game's checkPairing). It draws "The
// pair" (Check against: the open game or the Built-in game, and the result in one line), then the pair's problems, warnings and notes,
// each with Go to into the pack that holds it and, where the other pack is the cause, into that one too. Nothing here edits a pack.

import { h } from '../../ui/kit/dom.js';
import { pairPacks } from '../pairing.js';
import { partOfPath } from '../parts.js';
import { pathSteps } from '../check.js';

const KEEP = 'pairing';
const INTRO = 'The world’s start date, dated and seasonal events, birthdays and regions against a game’s calendar and names. Nothing here stops play: a reader who picks the pair loses only the parts named, and sees them in Problems.';
const BUILT_IN = 'The Built-in game: 12 months, January to December, and spring, summer, autumn and winter. It has no name lists.';
const WAITS = 'The pair is checked once both packs pass their own check.';
const MARK = { error: ['✕', 'var(--su-bad-t, var(--su-bad))'], warning: ['!', 'var(--su-warn)'], info: ['i', 'inherit'], ok: ['✓', 'inherit'] };
const GROUPS = [['errors', 'error', 'Problems', ' · switched off in this pair'], ['warnings', 'warning', 'Warnings', ''], ['info', 'info', 'Notes', '']];
// A part of each kind that Go to can open, so that the pack it belongs to becomes the active one before Problems is shown.
const HOME = { world: 'lore', game: 'calendar' };

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const nameOf = doc => String((isObject(doc) && (doc.name || doc.id)) || 'the pack');
const mark = level => h('span', { class: 'st-mark', 'aria-hidden': 'true', style: { color: MARK[level][1], 'margin-right': '6px' } }, MARK[level][0]);
const row = (cls, title, sub, ctl = null, data = {}) => h('div', { class: `srow ${cls}`, dataset: data }, h('div', { class: 'lb' }, h('b', title), sub ? h('small', sub) : null), ctl);

// One pairing per pair of snapshots: the nav asks for the page on every redraw, and the checker reads the whole of both packs.
let memo = null;
function pairOf(world, game) {
    if (memo?.world !== world || memo?.game !== game) memo = { world, game, answer: pairPacks(JSON.stringify(world ?? null), game ? JSON.stringify(game) : null) };
    return memo.answer;
}

// What the entry's own Go to says, and where the other pack's Go to leads (the game's calendar for a date, the world's regions for a culture).
const OWN = { PAIR_START_DATE: 'start date', PAIR_BIRTHDAY: 'the birthday', PAIR_CULTURE: 'names', PAIR_RECOMMENDS: 'overview' };
const CALENDAR = new Set(['PAIR_START_DATE', 'PAIR_EVENT_DATE', 'PAIR_EVENT_SEASON', 'PAIR_BIRTHDAY']);

// The cast member a birthday entry is about, by its path (`content.cast[2].birthday`), for their name.
const personOf = (entry, world) => world?.content?.cast?.[Number(/^content\.cast\[(\d+)\]/.exec(entry.path)?.[1])]?.name;

function headline(entry, world) {
    const id = entry.part?.id ?? '';
    switch (entry.code) {
        case 'PAIR_START_DATE': return 'The start date is not on this calendar.';
        case 'PAIR_EVENT_DATE': case 'PAIR_EVENT_SEASON': return `${entry.part?.kind === 'template' ? 'Template' : 'Event'} ${id} never fires.`;
        case 'PAIR_BIRTHDAY': return `${personOf(entry, world) || id}’s birthday is dropped.`;
        case 'PAIR_CULTURE': return `Name list ${id} is unused.`;
        case 'PAIR_RECOMMENDS': return `${nameOf(world)} suggests the game pack ${id}.`;
        default: return entry.message;
    }
}

function subLine(entry, world) {
    if (entry.code !== 'PAIR_RECOMMENDS') return entry.message;
    const version = world?.recommends?.game?.version;
    return `Its suggested game${version ? ` (version ${version})` : ''}. Any game works with any world.`;
}

/** The Go to links of one entry: `[{ pack, name, label, part, rec, field }]`, its own pack's first. */
function linksOf(entry, names, gameOpen) {
    const at = partOfPath(entry.path, entry.pack);
    const own = { pack: entry.pack, name: names[entry.pack], label: OWN[entry.code] ?? (entry.part?.kind === 'template' ? 'the template' : (entry.part?.kind === 'event' ? 'the event' : 'Go to')),
        part: at.part, rec: at.rec, field: at.rec ? pathSteps(entry.path).slice(3) : null };
    const links = [own];
    if (CALENDAR.has(entry.code) && gameOpen) links.push({ pack: 'game', name: names.game, label: 'calendar', part: 'calendar', rec: null, field: null });
    if (entry.code === 'PAIR_CULTURE') links.push({ pack: 'world', name: names.world, label: 'regions', part: 'map', rec: null, field: null });
    return links;
}

function goLinks(ctx, links) {
    return h('div', { class: 'ctl st-pair-go', style: { 'flex-direction': 'column', 'align-items': 'flex-end', gap: '2px' } },
        links.map(link => h('button', { type: 'button', class: 'lnk', dataset: { pack: link.pack, part: link.part }, onClick: () => ctx.go(link.part, link.rec, link.field) }, `${link.name}: ${link.label} ›`)));
}

// "Open a game pack": a game pack.json opened beside the world, as if it had been picked; the page is shown again with the pair.
function openGame(ctx, kept) {
    const input = h('input', { type: 'file', accept: '.json,application/json', class: 'st-pair-file', hidden: true, 'aria-hidden': 'true' });
    input.addEventListener('change', async () => {
        const file = input.files?.[0];
        if (!file) return;
        const done = ctx.openDoc?.({ text: await file.text(), name: file.name }) ?? { ok: false, refusal: 'The Studio cannot open a pack here.' };
        kept.note = done.ok ? '' : done.refusal;
        ctx.go('pairing');
    });
    return [h('button', { type: 'button', class: 'btn2 st-pair-open', onClick: () => input.click() }, 'Open a game pack'), input];
}

// "Check against": the open game pack or the Built-in game (a segmented switch); with no game open, the Built-in game and Open.
function againstRow(ctx, kept, game, builtIn) {
    const pick = value => () => { kept.builtIn = value; ctx.go('pairing'); };
    const choices = [game ? [false, `${nameOf(game)}${game.version ? ` · ${game.version}` : ''}`] : null, [true, 'Built-in game']].filter(Boolean)
        .map(([value, label]) => h('button', { type: 'button', 'aria-pressed': String(builtIn === value), dataset: { against: value ? 'built-in' : 'game' }, onClick: pick(value) }, label));
    const sub = game ? 'The open game pack, or the Built-in game: what a reader plays with no game pack'
        : 'No game pack is open, so the world is checked against the Built-in game: what a reader plays with no game pack';
    return row('st-pair-against', 'Check against', sub, h('div', { class: 'ctl' }, h('div', { class: 'sseg2', role: 'group', 'aria-label': 'Check against' }, choices), game ? null : openGame(ctx, kept)));
}

function resultRows(ctx, answer, names, builtIn) {
    const other = builtIn ? 'the Built-in game' : names.game;
    if (answer.blocked.length) {
        const passes = ['world', 'game'].filter(pack => (pack === 'world' || !builtIn) && !answer.blocked.some(item => item.pack === pack));
        return answer.blocked.map(item => row('st-pair-result', [mark('error'), `Pairing waits for the ${item.pack}: ${names[item.pack]} has ${plural(item.errors, 'problem')}.`],
            [WAITS, ...passes.map(pack => `${names[pack]} passes.`)].join(' '),
            goLinks({ go: () => { ctx.go(HOME[item.pack]); ctx.go('problems'); } }, [{ pack: item.pack, name: names[item.pack], label: 'problems', part: 'problems' }]), { state: 'blocked', pack: item.pack }));
    }
    const counts = [[answer.errors.length, 'problem', 'error'], [answer.warnings.length, 'warning', 'warning'], [answer.info.length, 'note', 'info']].filter(([n]) => n);
    if (!answer.errors.length && !answer.warnings.length) {
        const sub = builtIn ? BUILT_IN : (answer.info.length ? plural(answer.info.length, 'note') : 'Each pack passes its own check, and the pair does too.');
        return [row('st-pair-result', [mark('ok'), `${names.world} fits ${other}: nothing is switched off.`], sub, null, { state: 'fits' })];
    }
    const said = counts.flatMap(([n, word, level], at) => [at ? ' · ' : '', level === 'info' ? plural(n, word) : h('span', { class: 'st-count', dataset: { level }, style: { color: MARK[level][1] } }, plural(n, word))]);
    return [row('st-pair-result', [`${names.world} with ${other}: `, ...said], 'These don’t stop Export: each pack passes on its own.', null, { state: 'found' })];
}

function legacyPage(ctx) {
    return [h('section', { class: 'sgrp st-pair-wrap' }, h('div', { class: 'gt' }, 'The pair'),
        row('st-pair-result', 'Pairing needs a format 4 world.', 'This pack is in an older format, so it has no calendar dates to check. Convert it on Overview first.',
            goLinks(ctx, [{ pack: 'world', name: nameOf(ctx.doc), label: 'overview', part: 'overview', rec: null, field: null }]), { state: 'legacy' }))];
}

/** `ctx`: the page context (views/route.js) of the world pack; `ctx.other` is the open game pack's document, or null. */
export function renderPage(ctx) {
    if (ctx.legacy) return legacyPage(ctx);
    const kept = ctx.keep?.(KEEP) ?? {};
    const game = isObject(ctx.other) ? ctx.other : null;
    const builtIn = !game || kept.builtIn === true;
    const answer = pairOf(ctx.doc, builtIn ? null : game);
    const names = { world: nameOf(ctx.doc), game: game ? nameOf(game) : 'the Built-in game' };
    const groups = answer.paired ? GROUPS.filter(([key]) => answer[key].length).map(([key, level, title, more]) => h('section', { class: 'sgrp st-pair-list', dataset: { level } },
        h('div', { class: 'gt' }, `${title} · ${answer[key].length}${more}`),
        answer[key].map(entry => row('st-pair', [mark(level), headline(entry, ctx.doc)], subLine(entry, ctx.doc), goLinks(ctx, linksOf(entry, names, !builtIn)), { level, code: entry.code })))) : [];
    return [
        h('p', { class: 'fine st-pair-intro' }, INTRO),
        h('section', { class: 'sgrp st-pair-wrap' }, h('div', { class: 'gt' }, 'The pair'), againstRow(ctx, kept, game, builtIn), resultRows(ctx, answer, names, builtIn),
            kept.note ? row('st-pair-note', 'Not opened', kept.note, null, { level: 'error' }) : null),
        ...groups,
    ];
}
