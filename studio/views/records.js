// The view of one pack section (lore, cast, places and routes, conditions, events, templates, powers, items, a game pack's parts and
// anything else): one card per record, its title, a short line, its flags and every field as written; a section that is not a list is
// drawn as one card. Every card of a pack that can be edited ends in its JSON row (views/json-row.js), so any part can be edited, as
// JSON, before its form exists. The editor stubs (studio/edit/*.js) draw this until their form exists.

import { h } from '../../ui/kit/dom.js';
import { jsonRow } from './json-row.js';
import { recordCard, valueNode } from './value.js';

const SHOWN = 40; // records drawn before "Show all"
const join = (...parts) => parts.filter(part => part !== undefined && part !== null && part !== '').join(' · ');

// Per content kind: the title, the short line, the true/false flags shown as tags, the fields drawn first and those left out.
const SPECS = {
    lore: { title: r => r.title ?? r.id, flags: ['hidden', 'protected', 'constant'], first: ['keys', 'secondaryKeys', 'logic', 'order', 'gate', 'id', 'text'], skip: ['title'] },
    cast: { title: r => r.name ?? r.id, sub: r => join(r.kind, r.role), flags: ['protected', 'canDieUnmet'], first: ['id', 'aliases', 'species', 'gender', 'age', 'look', 'wears', 'voice', 'personality', 'homeBase', 'start', 'withYou', 'meters', 'stages', 'secrets', 'ties', 'keyRelationships'], skip: ['name', 'kind', 'role'] },
    places: { title: r => r.name ?? r.id ?? r.slug, sub: r => join(r.kind, r.region), flags: ['hidden', 'secret'], skip: ['name'] },
    routes: { title: r => r.name ?? `${r.from} – ${r.to}`, sub: r => join(r.kind, typeof r.km === 'number' ? `${r.km} km` : null), skip: ['name'] },
    regions: { title: r => r.name ?? r.id, skip: ['name'] },
    realms: { title: r => r.name ?? r.id, skip: ['name'] },
    conditions: { title: r => r.name, sub: r => join(r.scope, r.fades), flags: ['open', 'placeStatus'], first: ['means', 'effects'], skip: ['name', 'scope', 'fades'] },
    worldEvents: { title: r => r.id, sub: r => join(r.kind, r.severity), flags: ['once'] },
    events: { title: r => r.id, sub: () => 'legacy dated event', flags: ['once'] },
    templates: { title: r => r.template ?? r.id, flags: ['open'] },
    powers: { title: r => r.name ?? r.id, sub: r => (typeof r.start === 'number' ? `starts at ${r.start}` : ''), skip: ['name'] },
    scores: { title: r => r.name ?? r.id, sub: r => (typeof r.start === 'number' ? `starts at ${r.start}` : ''), skip: ['name'] },
    items: { title: r => r.name ?? r.id ?? r.slug, sub: r => join(r.type, r.slot), skip: ['name'] },
    foes: { title: r => r.name ?? r.id, sub: r => join(r.tier), skip: ['name'] },
};
const NOUNS = { lore: 'entry', cast: 'person', places: 'place', routes: 'route', regions: 'region', realms: 'realm', conditions: 'condition', worldEvents: 'event', events: 'event',
    templates: 'template', powers: 'power', scores: 'score', items: 'item', foes: 'foe' };
const LABELS = { placeKinds: 'Place kinds', routeKinds: 'Route kinds', worldEvents: 'World events', events: 'Legacy events', start: 'Starting world', meterPresets: 'Meter presets', dataModules: 'Data modules', rpg: 'RPG' };
const labelOf = (key, kind) => (key === 'start' && kind === 'game' ? 'Player start' : LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1));

function fieldsOf(record, spec) {
    const skip = new Set([...(spec.skip ?? []), ...(spec.flags ?? [])]);
    const first = (spec.first ?? []).filter(key => record[key] !== undefined);
    const rest = Object.keys(record).filter(key => !first.includes(key) && !skip.has(key));
    return [...first, ...rest].map(key => [key, record[key]]);
}

// Where a section sits in the pack, as patch steps and as the checker writes it.
const placeOf = section => (section.where === 'top' ? { steps: [section.key], at: section.key } : { steps: ['content', section.key], at: `content.${section.key}` });

// The JSON row under a card, when the pack can be edited (a format 3 pack, or one with no commit, has none).
function withJson(node, { rec, value, steps, at, noun }, ctx) {
    if (ctx.legacy || typeof ctx.commit !== 'function' || typeof ctx.keep !== 'function') return node;
    const problems = (ctx.problems ?? []).filter(problem => problem.path === at || String(problem.path).startsWith(`${at}.`) || String(problem.path).startsWith(`${at}[`));
    const focus = ctx.focus?.rec === rec ? ctx.focus : null;
    node.append(jsonRow({ value, steps, noun, problems, focus, state: ctx.keep(`json:${rec}`) }, patches => ctx.commit(patches)));
    return node;
}

function card(section, record, index, ctx) {
    const key = section.key;
    const rec = `${key}.${index}`;
    const place = placeOf(section);
    const json = { rec, value: record, steps: [...place.steps, index], at: `${place.at}[${index}]`, noun: NOUNS[key] ?? 'record' };
    if (record === null || typeof record !== 'object' || Array.isArray(record)) return withJson(recordCard({ rec, title: `#${index + 1}`, fields: [['value', record]] }), json, ctx);
    const spec = SPECS[key] ?? { title: r => r.name ?? r.id ?? r.title ?? `#${index + 1}` };
    const flags = (spec.flags ?? []).filter(flag => record[flag] === true);
    const aside = key === 'cast' ? ctx.portrait?.(record.portrait) ?? null : null;
    return withJson(recordCard({ rec, title: spec.title(record) ?? `#${index + 1}`, sub: spec.sub?.(record) ?? '', flags, fields: fieldsOf(record, spec), aside }), json, ctx);
}

function listSection(section, ctx, focused) {
    const list = section.value;
    const body = h('div', { class: 'st-list' });
    const draw = count => body.replaceChildren(...list.slice(0, count).map((record, index) => card(section, record, index, ctx)));
    const kept = ctx.keep?.(`all:${section.key}`) ?? {};
    const all = focused || kept.on === true;
    draw(all ? list.length : SHOWN);
    const more = list.length > SHOWN && !all
        ? h('button', { type: 'button', class: 'btn2 st-more', onClick: event => { kept.on = true; draw(list.length); event.currentTarget.remove(); } }, `Show all ${list.length}`)
        : null;
    return [body, more];
}

/**
 * One section of a part (`{ key, value, count }` from parts.js) as a node: a list section as one card per record, anything else as
 * one card. `ctx`: the editor context (views/route.js; `portrait(name) → node|null`, `focus`, `problems`, `commit`, `keep`); a `focus` on a
 * record draws the whole list so Go to can reach it, and opens the record's JSON row at the field.
 */
export function renderSection(section, ctx = {}) {
    const place = placeOf(section);
    const label = labelOf(section.key, ctx.kind);
    const whole = () => withJson(h('section', { class: 'sgrp st-rec', dataset: { rec: section.key }, tabindex: '-1' }, valueNode(section.value)),
        { rec: section.key, value: section.value, steps: place.steps, at: place.at, noun: label.toLowerCase() }, ctx);
    return h('div', { class: 'st-sec', dataset: { key: section.key } },
        h('div', { class: 'secl2' }, `${label} · ${section.count}`),
        Array.isArray(section.value) ? listSection(section, ctx, Boolean(ctx.focus?.rec)) : whole());
}
