// The cast editor's NPC State groups for one person: Level, meters (a preset and starting values), stages, secrets with their gates, Abilities
// and Keepsakes, and the "what NPC State seeds" panel (model/seed-preview.js: the game's own seeding run on the entry as written). Each list
// is a sub-record list whose › opens that item's form below it; the open item lives in the record's keep state, so it outlives a redraw.

import { h } from '../../ui/kit/dom.js';
import { CAST_BUILT_IN_METERS, CAST_BUILT_IN_PRESETS, METER_RESERVED, SLUG, WORLD_CAST_LIMITS } from '../../packs/limits.js';
import { fieldRow, setProblem } from '../form/fields.js';
import { gateField } from '../form/gate.js';
import { subRecords } from '../form/records.js';
import { renameId } from '../model/rename.js';
import { previewSeed } from '../model/seed-preview.js';

const NO_PRESET = '(none)';
const isObj = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const needsText = needs => (Array.isArray(needs) ? needs.map(need => `${need?.meter ?? '?'} ${need?.at ?? '?'}`).join(', ') : '');
const LABELS = { apparentAge: 'Looks', homeBase: 'Home base', keyRelationships: 'Key relationships', overallAppearance: 'Appearance', appearanceForms: 'Forms',
    behaviorProfile: 'Behaviour', relationshipSummary: 'With you', birthDate: 'Birthday', meterSetup: 'Meters', customFields: 'Other fields' };
const label = field => LABELS[field] ?? field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1').toLowerCase();

/** "trust 40, affection 20" → [{ meter, at }], or a string saying what is wrong. */
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

// A short line for any seeded value.
function shown(value) {
    if (Array.isArray(value)) return value.map(item => (isObj(item) ? item.name ?? item.title ?? item.id ?? Object.values(item).filter(v => typeof v !== 'object').join(' · ') : String(item))).join('; ');
    if (isObj(value)) return Object.entries(value).filter(([, v]) => v !== '' && v !== null && typeof v !== 'object').map(([k, v]) => `${k} ${v}`).join(', ') || JSON.stringify(value);
    return String(value);
}

/**
 * The NPC State groups. `person` is the cast entry at `kit.where`; `list` the whole cast. `kit`: `{ ctx, where, at, problems, state, focusPath,
 * commit(patches) → result, put(key, value) → result, redraw() }` from the record page (cast.js). Returns the group nodes.
 */
export function npcGroups(person, list, kit) {
    const { where, state, commit, focusPath } = kit;
    const focus = focusPath.join('.');
    // a Go to opens its item once; after that the reader's own opening and closing stands
    if (['stages', 'secrets', 'abilities', 'keepsakes'].includes(focusPath[0]) && Number.isInteger(focusPath[1]) && state.focused !== focus) {
        state.focused = focus;
        state.open = `${focusPath[0]}.${focusPath[1]}`;
    }
    const problemOf = written => {
        const key = written.replace(/\.(\d+)(?=\.|$)/g, '[$1]');
        return kit.problems.find(problem => problem.path === `${kit.at}.${key}` || String(problem.path).startsWith(`${kit.at}.${key}[`) || String(problem.path).startsWith(`${kit.at}.${key}.`))?.message;
    };
    const mark = row => {
        const control = focus && row.dataset?.key === focus ? row.querySelector('input,textarea,select,button') : null;
        if (control) { control.classList.add('st-at'); control.dataset.at = '0'; }
        return row;
    };
    const field = (spec, change) => mark(fieldRow({ problem: problemOf(spec.key), ...spec }, (_, value) => change(value)));
    const setAt = (path, value) => commit([{ op: 'set', path: [...where, ...path], value }]);
    // A secret's id: one that gates may name (learned:<person>/<secret>) is renamed with them (model/rename.js); a refusal shows by the field.
    const secretIdRow = (secret, n) => {
        const row = field({ type: 'text', key: `secrets.${n}.id`, label: 'Id', hint: 'Gates name it as learned:<person>/<secret>', value: secret.id ?? '' }, value => {
            const next = String(value).trim();
            if (next === secret.id) return null;
            if (typeof secret.id !== 'string' || !secret.id || typeof person.id !== 'string' || !person.id) return setAt(['secrets', n, 'id'], next);
            const plan = renameId(kit.ctx.refs, kit.ctx.doc, 'secret', `${person.id}/${secret.id}`, `${person.id}/${next}`);
            if (!plan.ok) return setProblem(row, plan.refusal);
            return commit(plan.patches);
        });
        return row;
    };
    const meters = isObj(person.meters) ? person.meters : null;
    const meterIds = Object.keys(meters ?? {}).filter(key => key !== 'preset');

    // Meters: blank removes one; the last one out (with no preset) takes `meters` away.
    const putMeter = (id, value) => {
        if (value === null || value === undefined) {
            if (!meters || !Object.hasOwn(meters, id)) return null;
            return commit([{ op: 'remove', path: Object.keys(meters).length === 1 ? [...where, 'meters'] : [...where, 'meters', id] }]);
        }
        return meters ? setAt(['meters', id], value) : setAt(['meters'], { [id]: value });
    };
    const presets = [NO_PRESET, ...CAST_BUILT_IN_PRESETS, ...(typeof meters?.preset === 'string' && !CAST_BUILT_IN_PRESETS.includes(meters.preset) ? [meters.preset] : [])];
    const addMeter = h('input', { class: 'txt2 st-meteradd', placeholder: 'Add a meter, like trust…', 'aria-label': 'Add a meter' });
    const addRow = h('div', { class: 'srow', dataset: { key: 'meters+' } }, h('span', { class: 'lb' }, h('b', 'Add a meter'), h('small', `Built in: ${CAST_BUILT_IN_METERS.join(', ')}; or a word of your own`)), h('span', { class: 'ctl' }, addMeter));
    addMeter.addEventListener('change', () => {
        const id = addMeter.value.trim().toLowerCase();
        if (!id) return;
        const wrong = !SLUG.test(id) ? `"${id}" is not a meter id: use lower-case words joined by "-".` : METER_RESERVED.includes(id) ? `"${id}" is a word NPC State keeps for itself.` : meterIds.includes(id) ? `${id} is already one of the meters.` : '';
        setProblem(addRow, wrong);
        if (!wrong) putMeter(id, 0);
    });
    const npc = h('section', { class: 'sgrp st-npc' }, h('div', { class: 'gt' }, 'NPC State'),
        field({ type: 'number', key: 'level', label: 'Level', hint: 'A whole number from 1 to 99. Blank: none', value: person.level ?? null }, value => (value === null ? kit.put('level', null) : setAt(['level'], value))),
        field({ type: 'select', key: 'meters.preset', label: 'Meter preset', hint: 'A set of meters NPC State adds (a preset of the game pack or the reader may be named in the JSON)', value: meters?.preset ?? NO_PRESET, options: presets },
            value => (value === NO_PRESET ? putMeter('preset', null) : putMeter('preset', value))),
        ...meterIds.map(id => field({ type: 'number', key: `meters.${id}`, label: id, hint: 'Starting value toward your character, -100 to 100. Blank: remove', value: meters[id] }, value => putMeter(id, value))),
        addRow);

    const groups = [npc,
        listGroup('stages', 'Stages', 'stage', person, kit, { mark, field, problemOf }, {
            sub: stage => [needsText(stage?.needs), stage?.text].filter(Boolean).join(' · '),
            make: () => ({ name: free(person.stages, 'New stage', 'name'), needs: [{ meter: meterIds[0] ?? 'trust', at: 20 }], text: '' }),
            form: (stage, n) => [
                field({ type: 'text', key: `stages.${n}.name`, label: 'Name', hint: 'Unique for this person; no | : #', value: stage.name ?? '' }, value => setAt(['stages', n, 'name'], String(value).trim())),
                needsRow(stage, n, mark, problemOf, setAt),
                field({ type: 'long', key: `stages.${n}.text`, label: 'What it means', hint: 'How things stand between them at this stage', value: stage.text ?? '', rows: 2 }, value => setAt(['stages', n, 'text'], value)),
                field({ type: 'text', key: `stages.${n}.milestone`, label: 'Milestone', hint: 'Recorded when the stage is reached. Blank: none', value: stage.milestone ?? '' },
                    value => (String(value).trim() ? setAt(['stages', n, 'milestone'], String(value).trim()) : Object.hasOwn(stage, 'milestone') && commit([{ op: 'remove', path: [...where, 'stages', n, 'milestone'] }]))),
            ],
        }),
        listGroup('secrets', 'Secrets', 'secret', person, kit, { mark, field, problemOf }, {
            sub: secret => (secret?.gate !== undefined || secret?.id !== undefined ? String(secret?.gate ?? 'no gate') : `old form · ${secret?.meter ?? '?'} ${secret?.at ?? ''}`.trim()),
            title: secret => secret?.id ?? secret?.title ?? '(no id)',
            make: () => ({ id: free(person.secrets, 'new-secret', 'id'), gate: `meter ${meterIds[0] ?? 'trust'} >= 20`, text: '' }),
            form: (secret, n) => (secret.id === undefined && secret.gate === undefined ? [h('p', { class: 'fine' }, 'This secret is in the old form (title, meter, at, when). Edit it in the JSON below, or write it again as id, gate and text.')] : [
                secretIdRow(secret, n),
                mark(gateField({ key: `secrets.${n}.gate`, label: 'Gate', hint: 'When it can come out. Terms joined by or / and; checked as you type', value: secret.gate ?? '', content: kit.ctx.doc?.doc?.content ?? kit.ctx.doc?.content ?? {}, ownerId: typeof person.id === 'string' ? person.id : null },
                    (_, value) => setAt(['secrets', n, 'gate'], value))),
                field({ type: 'long', key: `secrets.${n}.text`, label: 'Text', hint: 'The secret itself, at most 600 characters', value: secret.text ?? '', rows: 3 }, value => setAt(['secrets', n, 'text'], value)),
                field({ type: 'text', key: `secrets.${n}.writes_fact`, label: 'Fact it records', hint: 'Set when it is learned; events and gates test it as fact:<id>. Blank: none', value: secret.writes_fact ?? '' },
                    value => (String(value).trim() ? setAt(['secrets', n, 'writes_fact'], String(value).trim()) : Object.hasOwn(secret, 'writes_fact') && commit([{ op: 'remove', path: [...where, 'secrets', n, 'writes_fact'] }]))),
            ]),
        }),
        ...[['abilities', 'Abilities', 'ability', 'What they can do'], ['keepsakes', 'Keepsakes', 'keepsake', 'What they carry and keep']].map(([key, title, noun, hint]) => listGroup(key, title, noun, person, kit, { mark, field, problemOf }, {
            sub: item => item?.description ?? '',
            make: () => ({ name: free(person[key], `New ${noun}`, 'name'), description: '' }),
            form: (item, n) => [
                field({ type: 'text', key: `${key}.${n}.name`, label: 'Name', hint, value: item.name ?? '' }, value => setAt([key, n, 'name'], String(value).trim())),
                field({ type: 'long', key: `${key}.${n}.description`, label: 'Description', value: item.description ?? '', rows: 2 }, value => setAt([key, n, 'description'], value)),
            ],
        })),
        seedPanel(person, list, kit)];
    return groups;
}

function free(items, base, key) {
    const taken = new Set((Array.isArray(items) ? items : []).map(item => item?.[key]));
    let name = base;
    for (let n = 2; taken.has(name); n++) name = key === 'id' ? `${base}-${n}` : `${base} ${n}`;
    return name;
}

function needsRow(stage, n, mark, problemOf, setAt) {
    const row = mark(fieldRow({ type: 'text', key: `stages.${n}.needs`, label: 'Needs', hint: 'Each meter and the value it needs, like "trust 40, affection 20"', value: needsText(stage.needs), problem: problemOf(`stages[${n}].needs`) }, (_, value) => {
        const needs = readNeeds(value);
        setProblem(row, typeof needs === 'string' ? needs : '');
        if (typeof needs !== 'string') setAt(['stages', n, 'needs'], needs);
    }));
    return row;
}

// One list field as sub-records: move, remove (the last one takes the field away), add (at most the limit), and › to open an item's form.
function listGroup(key, title, noun, person, kit, tools, spec) {
    const { where, state, commit } = kit;
    const items = Array.isArray(person[key]) ? person[key] : [];
    const max = WORLD_CAST_LIMITS[key];
    const nameOf = item => String((spec.title ?? (entry => entry?.name))(item) ?? `(no ${noun === 'secret' ? 'id' : 'name'})`);
    // The open item is set before the commit (which draws the page again) and put back if the edit is refused.
    const opening = (open, patches) => {
        const was = state.open;
        state.open = open;
        const result = commit(patches);
        if (!result?.ok) state.open = was;
        return result;
    };
    const add = () => {
        if (items.length >= max) return;
        const value = spec.make();
        opening(`${key}.${items.length}`, [Array.isArray(person[key]) ? { op: 'insert', path: [...where, key, items.length], value } : { op: 'set', path: [...where, key], value: [value] }]);
    };
    const group = subRecords({ title, addLabel: `+ Add ${noun === 'ability' ? 'an' : 'a'} ${noun}`, items: items.map(item => ({ title: nameOf(item), sub: spec.sub(item) })) }, {
        add,
        move: (from, step) => opening(state.open === `${key}.${from}` ? `${key}.${from + step}` : state.open, [{ op: 'move', path: [...where, key, from], to: from + step }]),
        remove: from => opening(String(state.open).startsWith(`${key}.`) ? null : state.open, [{ op: 'remove', path: items.length === 1 ? [...where, key] : [...where, key, from] }]),
    });
    group.dataset.key = key;
    group.classList.add(`st-${key}`);
    const addButton = group.querySelector('.addrow button');
    if (addButton && items.length >= max) { addButton.disabled = true; addButton.title = `At most ${max}.`; }
    const rows = group.querySelectorAll('.subrow');
    rows.forEach(row => {
        const n = Number(row.dataset.index);
        const open = state.open === `${key}.${n}`;
        row.querySelector('.ctl').append(h('button', { type: 'button', class: 'btn2 st-open', 'aria-expanded': String(open), 'aria-label': `${open ? 'Close' : 'Open'} ${nameOf(items[n])}`,
            onClick: () => { state.open = open ? null : `${key}.${n}`; kit.redraw(); } }, open ? '‹' : '›'));
        if (tools.problemOf(`${key}[${n}]`)) row.classList.add('bad');
        // the open item's form sits under its row (before the next row, or the add row)
        if (open && items[n] && typeof items[n] === 'object') (rows[n + 1] ?? group.querySelector('.addrow')).before(h('div', { class: 'st-subform', dataset: { open: `${key}.${n}` } }, ...spec.form(items[n], n)));
    });
    const loose = kit.problems.find(problem => problem.path === `${kit.at}.${key}`);
    if (loose) group.append(h('small', { class: 'st-problem', role: 'alert' }, loose.message));
    return group;
}

// "What NPC State seeds": the record the first meeting would make from this entry, field by field.
function seedPanel(person, list, kit) {
    const { state } = kit;
    const head = h('div', { class: 'srow st-seedbar' },
        h('span', { class: 'lb' }, h('b', 'What NPC State seeds'), h('small', 'The person record NPC State makes from this entry when your character first meets them')),
        h('span', { class: 'ctl' }, h('button', { type: 'button', class: 'btn2 st-seedshow', 'aria-expanded': String(Boolean(state.seed)), onClick: () => { state.seed = !state.seed; kit.redraw(); } }, state.seed ? 'Hide' : 'Show')));
    const group = h('section', { class: 'sgrp st-seed' }, h('div', { class: 'gt' }, 'Seeding'), head);
    if (!state.seed) return group;
    const places = new Map((kit.ctx.doc?.doc?.content?.places ?? kit.ctx.doc?.content?.places ?? []).map(place => [place?.id, place?.name]));
    let seeded;
    try { seeded = previewSeed(person, { cast: list, placeName: id => places.get(id) ?? null, gated: state.gated === true, packName: kit.ctx.doc?.doc?.name ?? kit.ctx.doc?.name ?? '' }); } catch (error) { seeded = { ok: false, error }; }
    if (!seeded.ok) {
        group.append(h('p', { class: 'fine' }, seeded.error ? `The preview could not run: ${seeded.error.message ?? seeded.error}.` : 'Give this person a name (and fix the problems above) to see what NPC State would make of them.'));
        return group;
    }
    group.append(fieldRow({ type: 'toggle', key: 'seed.gated', label: 'With world secrets on', hint: 'The reader\'s setting that keeps gated secrets hidden until their gate opens', value: state.gated === true }, (_, value) => { state.gated = value; kit.redraw(); }),
        ...seeded.fields.map(({ field, value }) => h('div', { class: 'srow st-seedrow', dataset: { field } }, h('span', { class: 'lb' }, h('b', label(field)), h('small', shown(value))))),
        Array.isArray(seeded.stages) && seeded.stages.length ? h('p', { class: 'fine' }, `Stages: ${seeded.stages.map(stage => stage?.name ?? stage).join(', ')}.`) : null,
        seeded.overflow ? h('p', { class: 'fine' }, `Left out (over NPC State's limits): ${shown(seeded.overflow)}.`) : null);
    return group;
}
