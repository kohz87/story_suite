// The game pack's Trackers part (views/route.js EDITORS: meterPresets, dataModules), mock MK-7: the meter presets (ready-made meter sets for
// NPC State, at most 4 presets of 6 meters) as a list and one preset's record page (id, title, its meters with range, start, bands and drift,
// its stages with what they need, and the JSON row), and the data modules, each a checked JSON row with no form. A part is drawn per key the
// pack holds, so the section that is drawn also shows the other one's empty state ("No meter presets" and its add button).

import { h } from '../../ui/kit/dom.js';
import { METER_LIMITS, METER_RESERVED, SLUG } from '../../packs/limits.js';
import { fieldRow, setProblem } from '../form/fields.js';
import { chipList } from '../form/list.js';
import { jsonRow } from '../views/json-row.js';
import { renderSection } from '../views/records.js';

const PART = 'trackers';
const BASE = ['content', 'meterPresets'];
const SCOPE = { chat: 'kept per chat', character: 'kept per character' };
const BAND = /^(-?\d+)\s+(\S.*)$/;
const isObj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const whole = (value, min, max) => Number.isInteger(value) && value >= min && value <= max;
const contentOf = ctx => (isObj(ctx.doc?.doc?.content) ? ctx.doc.doc.content : isObj(ctx.doc?.content) ? ctx.doc.content : {});
const under = (problem, path) => problem.path === path || [`${path}.`, `${path}[`].some(start => String(problem.path).startsWith(start));
const needsText = needs => (Array.isArray(needs) ? needs.map(need => `${need?.meter ?? '?'} ${need?.at ?? '?'}`).join(', ') : '');
const meterLine = m => `${m.id ?? '?'} · ${m.min ?? '?'} to ${m.max ?? '?'}, starts at ${m.start ?? '?'}`;
const group = (title, ...rows) => h('section', { class: 'sgrp' }, h('div', { class: 'gt' }, title), ...rows.flat().filter(Boolean));

function freeId(taken, base) {
    let id = base;
    for (let n = 2; taken.includes(id); n++) id = `${base}-${n}`;
    return id;
}

/** "trust 40, affection -20" → [{ meter, at }], or a sentence saying what is wrong. */
function readNeeds(text) {
    const parts = String(text).split(',').map(part => part.trim()).filter(Boolean);
    if (!parts.length) return 'Name at least one meter and the value it needs, like "trust 40".';
    const needs = [];
    for (const part of parts) {
        const match = /^([a-z0-9-]+)\s*(?:>=|≥|:)?\s*(-?\d+)$/.exec(part);
        if (!match) return `"${part}" is not a meter and a value, like "trust 40".`;
        needs.push({ meter: match[1], at: Number(match[2]) });
    }
    return needs;
}

// ---- the presets list -------------------------------------------------------------------------------------------------------------------------------

function presetsList(list, ctx) {
    const full = list.length >= METER_LIMITS.presets;
    const add = () => {
        const fresh = { id: freeId(list.map(p => p?.id), 'new-preset'), title: 'New preset', meters: [{ id: 'regard', name: 'Regard', min: -100, max: 100, start: 0 }] };
        const made = ctx.commit(contentOf(ctx).meterPresets === undefined ? [{ op: 'set', path: BASE, value: [fresh] }] : [{ op: 'insert', path: [...BASE, list.length], value: fresh }]);
        if (made?.ok) ctx.go(PART, `meterPresets.${list.length}`);
    };
    const bad = index => (ctx.problems ?? []).filter(problem => under(problem, `content.meterPresets[${index}]`)).length;
    const rows = list.map((preset, index) => h('button', { type: 'button', class: 'st-trow st-preset', dataset: { rec: `meterPresets.${index}` }, onClick: () => ctx.go(PART, `meterPresets.${index}`) },
        h('span', null, h('b', String(preset?.title ?? preset?.id ?? `#${index + 1}`)), h('small', `${preset?.id ?? '?'} · ${plural(Array.isArray(preset?.meters) ? preset.meters.length : 0, 'meter')} · ${plural(Array.isArray(preset?.stages) ? preset.stages.length : 0, 'stage')}`)),
        bad(index) ? h('span', { class: 'st-bad' }, `✕ ${bad(index)}`) : null, h('span', { 'aria-hidden': 'true' }, '›')));
    const head = list.length
        ? h('div', { class: 'gt' }, `Meter presets · ${list.length}`)
        : [h('div', { class: 'gt' }, 'Meter presets'), h('div', { class: 'srow wide st-none' }, h('span', { class: 'lb' }, h('b', 'No meter presets'),
            h('small', `A preset is a ready set of meters (and stages) for NPC State: up to ${METER_LIMITS.presets} presets of ${METER_LIMITS.meters} meters.`)))];
    return h('section', { class: 'sgrp st-presets', dataset: { key: 'meterPresets' } }, head, list.length ? h('div', { class: 'slist' }, rows) : null,
        h('div', { class: 'addrow' }, h('button', { type: 'button', class: 'btn2 st-add', disabled: full, onClick: add }, '+ Add a preset'),
            full ? h('small', { class: 'fine' }, `${METER_LIMITS.presets} presets is the most a pack may hold.`) : null));
}

// ---- one preset -------------------------------------------------------------------------------------------------------------------------------------

/** A list item row: title and line, › opens its form below, ↑ ↓ ×. */
function itemRow(spec, on) {
    return h('div', { class: 'srow subrow', dataset: { item: spec.item } },
        h('span', { class: 'lb' }, h('b', spec.title), h('small', spec.sub)),
        h('span', { class: 'ctl' },
            h('button', { type: 'button', class: 'btn2 st-open', 'aria-expanded': String(spec.open), 'aria-label': `${spec.open ? 'Close' : 'Open'} ${spec.title}`, onClick: on.open }, spec.open ? '⌄' : '›'),
            h('button', { type: 'button', class: 'btn2', 'aria-label': `Move ${spec.title} up`, disabled: spec.first, onClick: () => on.move(-1) }, '↑'),
            h('button', { type: 'button', class: 'btn2', 'aria-label': `Move ${spec.title} down`, disabled: spec.last, onClick: () => on.move(1) }, '↓'),
            h('button', { type: 'button', class: 'btn2 dng st-remove', 'aria-label': `Remove ${spec.title}`, onClick: on.remove }, '×')));
}

function meterForm(preset, m, n, io) {
    const at = ['meters', n];
    const key = field => `meters.${n}.${field}`;
    const row = (spec, change) => fieldRow({ ...spec, key: key(spec.key), problem: io.problem(key(spec.key)) }, (k, value) => change(value));
    // A meter id that stages name is renamed in their needs too, in the same undo step.
    const rename = value => {
        const id = value.trim();
        if (id === m.id) return;
        if (!SLUG.test(id) || id.length > METER_LIMITS.id) return io.tell(`A meter id is lowercase letters, digits and dashes, at most ${METER_LIMITS.id}.`);
        if (METER_RESERVED.includes(id)) return io.tell(`"${id}" is a word NPC State keeps for itself; pick another meter id.`);
        if (preset.meters.some((other, i) => i !== n && other?.id === id)) return io.tell(`Another meter is already "${id}".`);
        const follow = (Array.isArray(preset.stages) ? preset.stages : []).flatMap((stage, s) => (Array.isArray(stage?.needs) ? stage.needs : [])
            .map((need, i) => (need?.meter === m.id ? { op: 'set', path: [...io.where, 'stages', s, 'needs', i, 'meter'], value: id } : null))).filter(Boolean);
        return io.commit([{ op: 'set', path: [...io.where, ...at, 'id'], value: id }, ...follow]);
    };
    const number = (field, label, hint, low, high) => {
        const r = row({ type: 'number', key: field, label, hint, value: m[field] }, value => {
            const ok = whole(value, low(), high());
            setProblem(r, ok ? '' : `A whole number from ${low()} to ${high()}.`);
            if (ok) io.put([...at, field], value);
        });
        return r;
    };
    const bands = chipList({ key: key('bands'), label: 'Bands', hint: 'A value and the word from it up, lowest first, like "-50 hostile"', values: Array.isArray(m.bands) ? m.bands.map(b => `${b?.at} ${b?.word}`) : [], placeholder: '-50 hostile' }, (k, values) => {
        const wrong = values.find(text => !BAND.test(text.trim()));
        setProblem(bands, wrong ? `"${wrong}" is not a value and a word, like "-50 hostile".` : '');
        if (!wrong) io.put([...at, 'bands'], values.length ? values.map(text => { const [, value, word] = BAND.exec(text.trim()); return { at: Number(value), word }; }) : undefined);
    });
    setProblem(bands, io.problem(key('bands')));
    const toward = h('input', { type: 'number', class: 'txt2', value: m.drift?.toward ?? '', 'aria-label': 'Drifts toward' });
    const perDay = h('input', { type: 'number', class: 'txt2', value: m.drift?.perDay ?? '', 'aria-label': 'Drift per day' });
    const drift = h('div', { class: 'srow', dataset: { key: key('drift'), type: 'drift' } }, h('span', { class: 'lb' }, h('b', 'Drift'), h('small', 'The value it moves back toward, and by how much a day; both blank: no drift')),
        h('span', { class: 'ctl' }, toward, h('span', 'by'), perDay, h('span', 'a day')));
    const takeDrift = () => {
        const [t, d] = [toward.value, perDay.value].map(text => (String(text).trim() === '' ? null : Number(text)));
        if (t === null && d === null) { setProblem(drift, ''); return io.put([...at, 'drift'], undefined); }
        const ok = whole(t, m.min, m.max) && Number.isInteger(d) && d >= 1;
        setProblem(drift, ok ? '' : `Drift needs a whole number from ${m.min} to ${m.max} and a whole number of 1 or more a day.`);
        return ok ? io.put([...at, 'drift'], { toward: t, perDay: d }) : null;
    };
    toward.addEventListener('change', takeDrift);
    perDay.addEventListener('change', takeDrift);
    setProblem(drift, io.problem(key('drift')));
    return h('div', { class: 'st-item', dataset: { item: `meters.${n}` } },
        row({ type: 'text', key: 'id', label: 'Id', hint: 'Stages name it by this; renaming changes them too', value: m.id }, rename),
        row({ type: 'text', key: 'name', label: 'Name', hint: `Shown to the story, at most ${METER_LIMITS.name} characters`, value: m.name }, value => io.put([...at, 'name'], value.trim())),
        number('min', 'Lowest', `From ${METER_LIMITS.min}`, () => METER_LIMITS.min, () => (Number.isInteger(m.max) ? m.max - 1 : METER_LIMITS.max)),
        number('max', 'Highest', `Up to ${METER_LIMITS.max}`, () => (Number.isInteger(m.min) ? m.min + 1 : METER_LIMITS.min), () => METER_LIMITS.max),
        number('start', 'Starts at', 'Inside the range', () => (Number.isInteger(m.min) ? m.min : METER_LIMITS.min), () => (Number.isInteger(m.max) ? m.max : METER_LIMITS.max)),
        row({ type: 'long', key: 'describe', label: 'What it measures', hint: `For the story, at most ${METER_LIMITS.describe} characters`, rows: 2, value: m.describe ?? '' }, value => io.put([...at, 'describe'], value.trim() || undefined)),
        bands, drift);
}

function stageForm(st, n, io) {
    const at = ['stages', n];
    const key = field => `stages.${n}.${field}`;
    const row = (spec, change) => fieldRow({ ...spec, key: key(spec.key), problem: io.problem(key(spec.key)) }, (k, value) => change(value));
    const needs = row({ type: 'text', key: 'needs', label: 'Needs', hint: `Up to ${METER_LIMITS.needs} meters and values, like "trust 40, fear -20" (0 or more: at or above; below 0: at or below)`, value: needsText(st.needs) }, value => {
        const read = readNeeds(value);
        setProblem(needs, typeof read === 'string' ? read : '');
        if (typeof read !== 'string') io.put([...at, 'needs'], read);
    });
    return h('div', { class: 'st-item', dataset: { item: `stages.${n}` } },
        row({ type: 'text', key: 'id', label: 'Id', hint: 'Lowercase letters, digits and dashes, like "trusted"', value: st.id }, value => io.put([...at, 'id'], value.trim())),
        row({ type: 'text', key: 'name', label: 'Name', value: st.name }, value => io.put([...at, 'name'], value.trim())),
        needs,
        row({ type: 'long', key: 'milestone', label: 'Milestone', hint: 'What the story is told when the stage is first reached; blank: nothing', rows: 2, value: st.milestone ?? '' }, value => io.put([...at, 'milestone'], value.trim() || undefined)));
}

function itemsGroup(kind, preset, io, state) {
    const items = Array.isArray(preset[kind]) ? preset[kind] : [];
    const meters = kind === 'meters';
    const max = meters ? METER_LIMITS.meters : METER_LIMITS.stages;
    const add = () => {
        const id = freeId(items.map(item => item?.id), meters ? 'meter' : 'stage');
        const first = Array.isArray(preset.meters) && preset.meters[0];
        const value = meters ? { id, name: 'New meter', min: 0, max: 100, start: 0 } : { id, name: 'New stage', needs: [{ meter: first?.id ?? 'regard', at: 50 }] };
        const made = io.commit(preset[kind] === undefined ? [{ op: 'set', path: [...io.where, kind], value: [value] }] : [{ op: 'insert', path: [...io.where, kind, items.length], value }]);
        if (made?.ok) state[kind] = items.length;
    };
    const remove = n => {
        if (meters) {
            const users = (Array.isArray(preset.stages) ? preset.stages : []).filter(stage => Array.isArray(stage?.needs) && stage.needs.some(need => need?.meter === items[n]?.id));
            if (users.length) return io.tell(`${users.map(stage => `"${stage.name ?? stage.id}"`).join(', ')} need${users.length === 1 ? 's' : ''} the meter "${items[n].id}": change ${users.length === 1 ? 'that stage' : 'those stages'} first.`);
        }
        if (meters && items.length === 1) return io.tell('A preset needs at least one meter.');
        state[kind] = null;
        return io.commit(!meters && items.length === 1 ? [{ op: 'remove', path: [...io.where, kind] }] : [{ op: 'remove', path: [...io.where, kind, n] }]);
    };
    const rows = items.map((item, n) => {
        const open = state[kind] === n;
        const title = String(item?.name ?? item?.id ?? `#${n + 1}`);
        return [itemRow({ item: `${kind}.${n}`, title, sub: meters ? meterLine(item ?? {}) : `needs ${needsText(item?.needs) || 'nothing yet'}`, open, first: n === 0, last: n === items.length - 1 },
            { open: () => { state[kind] = open ? null : n; io.draw(); }, move: step => { state[kind] = null; io.commit([{ op: 'move', path: [...io.where, kind, n], to: n + step }]); }, remove: () => remove(n) }),
        open && isObj(item) ? (meters ? meterForm(preset, item, n, io) : stageForm(item, n, io)) : null];
    });
    return group(`${meters ? 'Meters' : 'Stages'} · ${items.length}`, setProblem(h('div', { class: 'srow wide', dataset: { key: kind } }, h('span', { class: 'lb' }, h('small', meters
        ? `1 to ${METER_LIMITS.meters} meters, from ${METER_LIMITS.min} to ${METER_LIMITS.max}`
        : `Up to ${METER_LIMITS.stages} stages a person reaches when the meters say so; none is fine`))), io.exact(kind)), rows,
    h('div', { class: 'addrow' }, h('button', { type: 'button', class: `btn2 st-add-${kind}`, disabled: items.length >= max, onClick: add }, meters ? '+ Add a meter' : '+ Add a stage')));
}

// `into`: the page's own node on a redraw (an item opened or closed, the delete confirm), which keeps its place; the focus applies on the first draw.
function presetPage(list, index, ctx, into = null) {
    const preset = list[index];
    const where = [...BASE, index];
    const rec = `meterPresets.${index}`;
    const mine = (ctx.problems ?? []).filter(problem => under(problem, `content.meterPresets[${index}]`));
    const state = ctx.keep?.(`trackers:${rec}`) ?? {};
    const focused = ctx.focus?.rec === rec && Array.isArray(ctx.focus.path) ? ctx.focus.path : null;
    if (focused && !into && (focused[0] === 'meters' || focused[0] === 'stages') && Number.isInteger(focused[1])) state[focused[0]] = focused[1];
    const said = h('p', { class: 'st-problem', role: 'alert', hidden: true });
    const tell = text => { said.textContent = text ?? ''; said.hidden = !text; return null; };
    const commit = patches => { const result = ctx.commit(patches); if (!result?.ok) tell(result?.refusal ?? 'The change was not made.'); return result; };
    const getAt = path => path.reduce((node, step) => (node && typeof node === 'object' ? node[step] : undefined), preset);
    const put = (path, value) => {
        if (value === undefined && getAt(path) === undefined) return null;
        return commit([value === undefined ? { op: 'remove', path: [...where, ...path] } : { op: 'set', path: [...where, ...path], value }]);
    };
    const problem = field => {
        const path = `content.meterPresets[${index}].${field.replace(/\.(\d+)(?=\.|$)/g, '[$1]')}`;
        return mine.find(item => under(item, path))?.message;
    };
    const root = into ?? h('section', { class: 'st-rec', dataset: { rec }, tabindex: '-1', 'aria-label': String(preset.title ?? preset.id ?? `Preset ${index + 1}`) });
    const exact = field => mine.find(item => item.path === `content.meterPresets[${index}].${field}`)?.message;
    const io = { where, put, commit, tell, problem, exact, draw: () => presetPage(list, index, ctx, root) };
    const copy = () => {
        if (list.length >= METER_LIMITS.presets) return tell(`${METER_LIMITS.presets} presets is the most a pack may hold.`);
        const made = commit([{ op: 'insert', path: [...BASE, index + 1], value: { ...structuredClone(preset), id: freeId(list.map(p => p?.id), `${preset.id ?? 'preset'}-copy`) } }]);
        return made?.ok ? ctx.go(PART, `meterPresets.${index + 1}`) : null;
    };
    const drop = () => {
        if (!state.confirm) { state.confirm = true; return io.draw(); }
        state.confirm = false;
        const made = commit(list.length === 1 ? [{ op: 'remove', path: BASE }] : [{ op: 'remove', path: where }]);
        return made?.ok ? ctx.go(PART) : null;
    };
    const textRow = (field, label, hint) => fieldRow({ type: 'text', key: field, label, hint, value: preset[field], problem: problem(field) }, (k, value) => put([field], value.trim()));
    const form = h('div', { class: 'st-edit', dataset: { rec: 'meterPresets' } },
        group('Preset', textRow('id', 'Id', 'A person\'s meter setup names the preset by this'), textRow('title', 'Title', `At most ${METER_LIMITS.title} characters`)),
        itemsGroup('meters', preset, io, state), itemsGroup('stages', preset, io, state));
    if (state.json === undefined) state.json = {};
    root.replaceChildren(h('div', { class: 'st-rh' }, h('button', { type: 'button', class: 'btn2 st-back', onClick: () => ctx.go(PART) }, '‹ Trackers'),
        h('span', { class: 'st-rt' }, h('b', String(preset.title ?? preset.id ?? ''))), h('small', `Preset ${index + 1} of ${list.length}`),
        h('span', { class: 'st-flags' }, h('button', { type: 'button', class: 'btn2 st-dup', onClick: copy }, 'Duplicate'),
            h('button', { type: 'button', class: `btn2 dng ${state.confirm ? 'st-sure' : 'st-del'}`, onClick: drop }, state.confirm ? 'Delete this preset' : 'Delete'))),
    said, form, jsonRow({ value: preset, steps: where, noun: 'preset', problems: mine, focus: focused ? ctx.focus : null, state: state.json }, patches => ctx.commit(patches)));
    if (focused && !into) markFocus(root, focused);
    return root;
}

// Go to / F8: the control of the deepest field on the path that the page draws gets `st-at` (and the caret at its start).
function markFocus(page, path) {
    for (let n = path.length; n > 0; n--) {
        const control = page.querySelector(`.st-edit [data-key="${path.slice(0, n).join('.')}"]`)?.querySelector('input,select,textarea');
        if (control) { control.classList.add('st-at'); control.dataset.at = '0'; return; }
    }
}

// ---- data modules -----------------------------------------------------------------------------------------------------------------------------------

function modulesGroup(list, ctx) {
    const state = ctx.keep?.('trackers:dataModules') ?? {};
    const focused = /^dataModules\.(\d+)$/.exec(ctx.focus?.rec ?? '');
    if (focused && Number(focused[1]) < list.length) state.open = Number(focused[1]);
    const box = h('section', { class: 'sgrp st-modules', dataset: { key: 'dataModules' } });
    const draw = () => box.replaceChildren(h('div', { class: 'gt' }, list.length ? `Data modules · ${list.length}` : 'Data modules'),
        h('div', { class: 'srow wide' }, h('span', { class: 'lb' }, list.length ? h('small', 'Each is checked JSON: it has no form.') : [h('b', 'No data modules'), h('small', 'A data module keeps its own state for the story (standing, fame, a membership); it is written as JSON.')])),
        ...list.map((module, index) => {
            const rec = `dataModules.${index}`;
            const open = state.open === index;
            const problems = (ctx.problems ?? []).filter(problem => under(problem, `content.dataModules[${index}]`));
            state[rec] ??= {};
            state[rec].open = true;
            return [h('div', { class: 'srow st-module', dataset: { rec } },
                h('span', { class: 'lb' }, h('b', String(module?.name ?? module?.slug ?? `#${index + 1}`)), h('small', [module?.slug, SCOPE[module?.scope] ?? module?.scope].filter(Boolean).join(' · '))),
                h('span', { class: 'ctl' }, problems.length ? h('span', { class: 'st-bad' }, `✕ ${problems.length}`) : null,
                    h('button', { type: 'button', class: 'btn2 lnk st-dmjson', 'aria-expanded': String(open), onClick: () => { state.open = open ? null : index; draw(); } }, open ? 'Close JSON' : 'Edit as JSON ›'))),
            open ? jsonRow({ value: module, steps: ['content', 'dataModules', index], noun: 'data module', problems, focus: ctx.focus?.rec === rec ? ctx.focus : null, state: state[rec] }, patches => ctx.commit(patches)) : null];
        }).flat().filter(Boolean));
    draw();
    return box;
}

/** `section`: `{ key: 'meterPresets' | 'dataModules', where, value, count }`; `ctx`: the editor context (views/route.js). Returns the section's nodes. */
export function editSection(section, ctx) {
    const content = contentOf(ctx);
    const clean = value => Array.isArray(value) && value.every(isObj);
    if (ctx.legacy || typeof ctx.commit !== 'function' || !clean(section.value)) return [renderSection(section, ctx)];
    const presets = section.key === 'meterPresets' ? section.value : clean(content.meterPresets) ? content.meterPresets : null;
    const at = presets ? (() => { const match = /^meterPresets\.(\d+)$/.exec(ctx.focus?.rec ?? ''); return match && Number(match[1]) < presets.length ? Number(match[1]) : -1; })() : -1;
    if (section.key === 'meterPresets') {
        if (at >= 0) return [h('div', { class: 'st-sec', dataset: { key: 'meterPresets' } }, presetPage(presets, at, ctx))];
        return [h('div', { class: 'st-sec', dataset: { key: 'meterPresets' } }, presetsList(presets, ctx), content.dataModules === undefined ? modulesGroup([], ctx) : null)];
    }
    // dataModules: with a preset open its page fills the part; with no meterPresets key, the presets' empty state comes first
    if (at >= 0) return [];
    return [h('div', { class: 'st-sec', dataset: { key: 'dataModules' } }, content.meterPresets === undefined ? presetsList([], ctx) : null, modulesGroup(section.value, ctx))];
}
