// The game pack's Rules (views/route.js EDITORS: you, rpg, pacing; mock MK-7 "rules"): your rank's label; the level cap and the rank bands
// (only where each ends is typed: each starts the level after the one before); the player rank from one of this pack's trackers; how a person
// who joins becomes a sheet (abilities as skills, a stance skill); the tempo; and the skill sets as JSON. Each key draws its own groups, and
// the first key the pack has also draws the groups of the keys it lacks (in the mock's order), so a field the pack has no key for yet can be
// filled in: its first value writes the key. Clearing the last value of a key takes the key out, unless the part would then be empty.

import { h } from '../../ui/kit/dom.js';
import { YOU_RANK_LABEL_MAX, RPG_RANK_LIMITS, RPG_PLAYER_RANK_LIMITS, RPG_PULL_LIMITS, GAME_PACING_LIMITS } from '../../packs/limits.js';
import { foldKey } from '../../core/text.js';
import { fieldRow, setProblem } from '../form/fields.js';
import { renderSection } from '../views/records.js';
import { jsonRow } from '../views/json-row.js';

const ORDER = ['you', 'rpg', 'pacing'];
const DRAWN = { you: ['rank'], rpg: ['ranks', 'levelCap', 'playerRank', 'pull', 'skillSets'], pacing: ['tempo'] };
const NONE = '(none)';
const R = RPG_RANK_LIMITS;
const isNode = value => value !== null && typeof value === 'object';
const isRecord = value => isNode(value) && !Array.isArray(value);
const contentOf = ctx => (isRecord(ctx.doc?.doc?.content) ? ctx.doc.doc.content : (isRecord(ctx.doc?.content) ? ctx.doc.content : {}));
const plain = (text, max) => (!text ? '' : text.length > max ? `At most ${max} characters.` : (/[<>{}]/.test(text) ? 'No < > { } in it.' : ''));
const getAt = (node, path) => path.reduce((at, key) => (at !== null && typeof at === 'object' ? at[key] : undefined), node);

// The keys whose groups this section draws: its own, and each key the pack lacks, by the nearest key before it that the pack has (else the first).
function keysFor(key, content) {
    const present = ORDER.filter(each => content[each] !== undefined);
    const owner = each => (present.includes(each) ? each : present.filter(other => ORDER.indexOf(other) < ORDER.indexOf(each)).at(-1) ?? present[0]);
    return ORDER.filter(each => owner(each) === key);
}

// Patches below `content`: `put` builds whatever objects are missing on the way; `drop` takes the value out with each object it leaves empty
// (a top key only while another of the three stays, so the part is not lost).
function writer(ctx, content, say) {
    const base = ['content'];
    const put = (path, value) => {
        let at = 0;
        while (at < path.length - 1 && isNode(getAt(content, path.slice(0, at + 1)))) at += 1;
        const built = path.slice(at + 1).reduceRight((inner, key) => ({ [key]: inner }), value);
        return say(ctx.commit([{ op: 'set', path: [...base, ...path.slice(0, at + 1)], value: built }]));
    };
    const drop = path => {
        if (getAt(content, path) === undefined) return null;
        let at = path.length;
        const others = ORDER.some(key => key !== path[0] && content[key] !== undefined);
        while (at > 1 && Object.keys(getAt(content, path.slice(0, at - 1)) ?? {}).length === 1 && (at > 2 || others)) at -= 1;
        return say(ctx.commit([{ op: 'remove', path: [...base, ...path.slice(0, at)] }]));
    };
    return { put, drop };
}

/** `section`: `{ key: 'you' | 'rpg' | 'pacing', where, value, count }`; `ctx`: the editor context (views/route.js). Returns the section's groups. */
export function editSection(section, ctx) {
    const content = contentOf(ctx);
    if (!ORDER.includes(section.key) || ctx.legacy || typeof ctx.commit !== 'function' || !isRecord(section.value)) return [renderSection(section, ctx)];
    const note = h('small', { class: 'st-problem', role: 'status' });
    const say = result => { if (result && !result.ok) note.textContent = result.refusal ?? 'The change was not made.'; return result; };
    const io = writer(ctx, content, say);
    const problemOf = path => (ctx.problems ?? []).find(problem => problem.path === `content.${path}`)?.message ?? '';
    const draw = { you: youGroups, rpg: rpgGroups, pacing: paceGroups };
    // keys of the other two that are not proper objects keep their own read-only cards; they draw nothing here
    const keys = keysFor(section.key, content).filter(key => key === section.key || content[key] === undefined);
    const extra = Object.keys(section.value).filter(key => !DRAWN[section.key].includes(key));
    return [h('div', { class: 'st-sec st-rules', dataset: { key: section.key } }, note,
        ...keys.flatMap(key => draw[key](content[key] ?? {}, { io, problemOf, ctx, content })),
        extra.length ? h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, 'Only in the JSON'),
            h('p', { class: 'fine' }, `Also in content.${section.key}: ${extra.join(', ')}. The form has no field for ${extra.length === 1 ? 'it' : 'them'}.`),
            jsonRow({ value: section.value, steps: ['content', section.key], noun: `${section.key} section`, problems: ctx.problems ?? [], state: ctx.keep?.(`json:rules.${section.key}`) ?? {} }, patches => say(ctx.commit(patches)))) : null)];
}

// A text row with a plain-text check; blank takes the value out.
function textRow({ key, label, hint, value, max, path, problem }, io) {
    const row = fieldRow({ type: 'text', key, label, hint, value: value ?? '', problem }, (_, typed) => {
        const next = String(typed).trim();
        const wrong = plain(next, max);
        setProblem(row, wrong);
        if (wrong || next === (value ?? '')) return;
        if (next) io.put(path, next); else io.drop(path);
    });
    return row;
}

// A number row in its bounds (`whole` for whole numbers); blank takes the value out.
function numberRow({ key, label, hint, value, bounds, whole = true, path, problem }, io) {
    const row = fieldRow({ type: 'number', key, label, hint, value: value ?? null, problem }, (_, typed) => {
        if (typed === null) { setProblem(row, ''); io.drop(path); return; }
        const fits = (!whole || Number.isInteger(typed)) && typed >= bounds.min && typed <= bounds.max;
        setProblem(row, fits ? '' : `${label} must be ${whole ? 'a whole number' : 'a number'} from ${bounds.min} to ${bounds.max}.`);
        if (fits && typed !== value) io.put(path, typed);
    });
    return row;
}

const group = (title, ...rows) => h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, title), ...rows.filter(Boolean));

function youGroups(you, { io, problemOf }) {
    return [group('Your rank', textRow({ key: 'you.rank.label', label: 'Rank label', hint: `What Home and the Status card call your rank (1 to ${YOU_RANK_LABEL_MAX} characters). Blank: no rank`,
        value: isRecord(you.rank) ? you.rank.label : '', max: YOU_RANK_LABEL_MAX, path: ['you', 'rank', 'label'], problem: problemOf('you.rank.label') || problemOf('you.rank') }, io))];
}

function paceGroups(pacing, { io, problemOf }) {
    return [group('Pace', numberRow({ key: 'pacing.tempo', label: 'Tempo', hint: `How fast the world moves: 2 = seasons last twice as long (${GAME_PACING_LIMITS.min} to ${GAME_PACING_LIMITS.max}). Blank: the reader's Tempo setting`,
        value: pacing.tempo, bounds: GAME_PACING_LIMITS, whole: false, path: ['pacing', 'tempo'], problem: problemOf('pacing.tempo') }, io))];
}

function rpgGroups(rpg, { io, problemOf, ctx, content }) {
    const pull = isRecord(rpg.pull) ? rpg.pull : {};
    const sets = Array.isArray(rpg.skillSets) ? rpg.skillSets : null;
    return [
        group('Levels',
            numberRow({ key: 'rpg.levelCap', label: 'Level cap', hint: `The highest level (1 to ${R.maxLevel})`, value: rpg.levelCap, bounds: { min: 1, max: R.maxLevel }, path: ['rpg', 'levelCap'], problem: problemOf('rpg.levelCap') }, io),
            ranksRows(rpg.ranks, { io, problemOf })),
        playerRank(rpg.playerRank, { io, problemOf, content }),
        group('People who join',
            numberRow({ key: 'rpg.pull.abilities', label: 'Abilities as skills', hint: `How many of a person's abilities become sheet skills when they join (${RPG_PULL_LIMITS.min} to ${RPG_PULL_LIMITS.max}). Blank: 4`,
                value: pull.abilities, bounds: RPG_PULL_LIMITS, path: ['rpg', 'pull', 'abilities'], problem: problemOf('rpg.pull.abilities') }, io),
            fieldRow({ type: 'toggle', key: 'rpg.pull.stance', label: 'Stance skill', hint: 'Add a stance skill too. Off: none', value: pull.stance !== false, problem: problemOf('rpg.pull.stance') },
                (_, on) => (on ? io.drop(['rpg', 'pull', 'stance']) : io.put(['rpg', 'pull', 'stance'], false)))),
        sets ? group('Skill sets',
            h('div', { class: 'srow wide', dataset: { key: 'rpg.skillSets' } }, h('span', { class: 'lb' }, h('b', `Skill sets · ${sets.length}`),
                h('small', sets.map(set => `${set?.name ?? 'unnamed'} · ${Array.isArray(set?.skills) ? set.skills.length : 0} skills`).join(' · ') || 'None'))),
            jsonRow({ value: sets, steps: ['content', 'rpg', 'skillSets'], noun: 'skill set list', problems: (ctx.problems ?? []).filter(problem => String(problem.path).startsWith('content.rpg.skillSets')),
                state: ctx.keep?.('json:rules.skillSets') ?? {} }, patches => ctx.commit(patches))) : null,
    ].filter(Boolean);
}

function playerRank(given, { io, problemOf, content }) {
    const rank = isRecord(given) ? given : null;
    const modules = (Array.isArray(content.dataModules) ? content.dataModules : []).filter(isRecord);
    const slugs = modules.map(module => module.slug).filter(slug => typeof slug === 'string');
    const chosen = rank && typeof rank.module === 'string' ? rank.module : NONE;
    const pick = fieldRow({ type: 'select', key: 'rpg.playerRank.module', label: 'From the tracker', hint: slugs.length ? 'One of this pack\'s trackers holds the rank' : 'This pack has no trackers yet (Trackers)',
        value: chosen, options: [NONE, ...slugs], problem: problemOf('rpg.playerRank.module') || problemOf('rpg.playerRank') }, (_, slug) => {
        if (slug === chosen) return;
        if (slug === NONE) { io.drop(['rpg', 'playerRank']); return; }
        if (rank) { io.put(['rpg', 'playerRank', 'module'], slug); return; }
        // the rank is most likely a field of named steps (an enum), else the first field
        const state = Object.entries(modules.find(module => module.slug === slug)?.state ?? {});
        const first = (state.find(([, spec]) => spec?.type === 'enum') ?? state[0])?.[0];
        io.put(['rpg', 'playerRank'], { module: slug, ...(first ? { field: first } : {}) });
    });
    if (!rank) return group('Player rank', pick);
    const fields = Object.keys(modules.find(module => module.slug === rank.module)?.state ?? {});
    return group('Player rank', pick,
        textRow({ key: 'rpg.playerRank.field', label: 'Its field', hint: fields.length ? `The tracker's field that holds it: ${fields.join(', ')}` : 'The tracker\'s field that holds it',
            value: rank.field, max: RPG_PLAYER_RANK_LIMITS.ref, path: ['rpg', 'playerRank', 'field'], problem: problemOf('rpg.playerRank.field') }, io),
        textRow({ key: 'rpg.playerRank.label', label: 'Shown as', hint: `On the card: "Lv 14 · ${rank.label || 'Guild'} F" (1 to ${RPG_PLAYER_RANK_LIMITS.label} characters)`,
            value: rank.label, max: RPG_PLAYER_RANK_LIMITS.label, path: ['rpg', 'playerRank', 'label'], problem: problemOf('rpg.playerRank.label') }, io));
}

// Each band starts the level after the one before ends, the first at 1.
const chain = list => list.map((band, at) => ({ ...band, from: at === 0 ? 1 : list[at - 1].to + 1 }));

function ranksRows(given, { io, problemOf }) {
    const ranks = Array.isArray(given) ? given.filter(isRecord) : [];
    const box = h('div', { class: 'srow wide', dataset: { key: 'rpg.ranks' } },
        h('span', { class: 'lb' }, h('b', 'Ranks'), h('small', `Each rank starts the level after the one before, so you type only where it ends. Up to ${R.name} characters a name.`)));
    if (Array.isArray(given) && ranks.length !== given.length) return [box, h('p', { class: 'fine' }, 'The ranks are written in a shape the form does not draw: edit them in the JSON.')];
    const save = list => (list.length ? io.put(['rpg', 'ranks'], chain(list)) : io.drop(['rpg', 'ranks']));
    const said = h('small', { class: 'st-problem st-rsaid', role: 'alert', hidden: true });
    const tell = text => { said.textContent = text; said.hidden = !text; };
    const rows = ranks.map((band, at) => {
        const problem = problemOf(`rpg.ranks[${at}]`) || problemOf(`rpg.ranks[${at}].name`) || problemOf(`rpg.ranks[${at}].from`);
        const name = h('input', { type: 'text', class: 'txt2 st-rname', value: band.name ?? '', 'aria-label': `Rank ${at + 1} name` });
        name.value = band.name ?? '';
        const to = h('input', { type: 'number', class: 'st-rto', value: band.to ?? '', 'aria-label': `Rank ${at + 1} ends at level` });
        to.value = band.to ?? '';
        const row = h('div', { class: 'srow subrow st-rank', dataset: { index: String(at) } },
            h('span', { class: 'lb' }, h('small', String(at + 1)), name),
            h('span', { class: 'ctl' }, h('span', { class: 'st-rfrom' }, String(band.from ?? '')), h('span', { class: 'num' }, to),
                h('button', { type: 'button', class: 'btn2 st-up', 'aria-label': `Move ${band.name} up`, disabled: at === 0, onClick: () => swap(at, at - 1) }, '↑'),
                h('button', { type: 'button', class: 'btn2 st-down', 'aria-label': `Move ${band.name} down`, disabled: at === ranks.length - 1, onClick: () => swap(at, at + 1) }, '↓'),
                h('button', { type: 'button', class: 'btn2 dng st-remove', 'aria-label': `Remove ${band.name}`, onClick: () => save(ranks.filter((_, i) => i !== at)) }, '×')));
        name.addEventListener('change', () => {
            const next = String(name.value).trim();
            const wrong = !next ? 'A rank needs a name.' : plain(next, R.name) || (ranks.some((other, i) => i !== at && foldKey(other.name) === foldKey(next)) ? `"${next}" is already a rank.` : '');
            setProblem(row, wrong);
            if (!wrong && next !== band.name) io.put(['rpg', 'ranks', at, 'name'], next);
        });
        to.addEventListener('change', () => {
            const end = Number(String(to.value).trim());
            const start = at === 0 ? 1 : ranks[at - 1].to + 1;
            const ceiling = at < ranks.length - 1 ? ranks[at + 1].to - 1 : R.maxLevel;
            const fits = String(to.value).trim() !== '' && Number.isInteger(end) && end >= start && end <= ceiling;
            setProblem(row, fits ? '' : `It ends at a whole level from ${start} to ${ceiling}${at < ranks.length - 1 ? ', before the next rank ends' : ''}.`);
            if (fits && end !== band.to) save(ranks.map((each, i) => (i === at ? { ...each, to: end } : each)));
        });
        return setProblem(row, problem);
    });
    // a move swaps the names; the levels stay where they are
    function swap(at, other) { save(ranks.map((band, i) => (i === at ? { ...band, name: ranks[other].name } : i === other ? { ...band, name: ranks[at].name } : band))); }
    const add = () => {
        const last = ranks.at(-1);
        const from = last ? last.to + 1 : 1;
        if (ranks.length >= R.entries) return tell(`A pack has at most ${R.entries} ranks.`);
        if (from > R.maxLevel) return tell(`The last rank already ends at level ${R.maxLevel}: end it lower first.`);
        let n = ranks.length + 1;
        while (ranks.some(band => foldKey(band.name) === foldKey(`Rank ${n}`))) n += 1;
        return save([...ranks, { name: `Rank ${n}`, from, to: Math.min(from + 9, R.maxLevel) }]);
    };
    const covered = ranks.length ? `levels 1 to ${ranks.at(-1).to}${ranks.every((band, at) => band.from === (at === 0 ? 1 : ranks[at - 1].to + 1)) ? ', no gap' : ', with a gap or overlap'}` : 'no ranks';
    return [setProblem(box, problemOf('rpg.ranks')), ...rows,
        h('div', { class: 'addrow' }, h('button', { type: 'button', class: 'btn2 st-add', onClick: add }, '+ Add a rank'), h('small', { class: 'fine st-rcount' }, `${ranks.length} of ${R.entries} · ${covered}`)), said];
}
