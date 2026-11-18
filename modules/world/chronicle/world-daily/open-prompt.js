// World events, open templates on the host: the Director's prompt for a batch of slots (model-facing, owner standing rule 18 Nov: the lead's
// wording) and the reading of its answer. The answer is JSON; code checks every pick against the menu (daily/open-check.js). Pure.

import { arcLine } from './open-arc-prompt.js';
import { wholeRows } from './open-salvage.js';

export const OPEN_SYSTEM = [
    'You fill in small happenings for a story world. Each slot below is a happening the world has already decided will occur at a place: you write what it is.',
    'Use only the menu given for that slot. Anything outside the menu is refused by code, and you may pick nothing from a key. Never name a person who is not listed for that slot.',
    'Never reveal or hint at lore marked hidden. Keep each summary to one or two plain sentences about what happens, not how the story reacts.',
    'Answer with JSON only: {"results":[{"slot":"<slot id>","name":"<short title>","summary":"<what happens>","people":["<cast id>"],"effects":{"powers":{"<id>":3},"scores":{"<id>":-2},"set":[{"condition":"<id>","for":"5 days"}],"clear":["<id>"],"ladder":{"direction":"up","steps":1},"cast":[{"id":"<cast id>","to":"<place id>"}],"fact":"<fact id>"}}]}.',
    'Leave out any effects key you do not use. One result per slot, using the slot id exactly as given.',
].join('\n');

const menuLine = (key, menu) => {
    if (key === 'powers' || key === 'scores') return `${key}: move up to ${menu.pick} of ${menu.of === 'any' ? 'any' : menu.of.join(', ')}, each by a whole number from ${menu.delta[0]} to ${menu.delta[1]}`;
    if (key === 'set') return `set: up to ${menu.pick} of ${menu.of.join(', ')} (at the ${menu.at}), each for at most ${menu.for === null ? 'any time' : `${menu.for} days`}`;
    if (key === 'clear') return `clear: up to ${menu.pick} of ${menu.of.join(', ')} (at the place)`;
    if (key === 'ladder') return `ladder: ${menu.of.join(' -> ')}; at most ${menu.step} step(s), direction ${menu.direction}`;
    return `cast: move up to ${menu.pick} of ${menu.of === 'figures' ? 'the figures listed' : menu.of.join(', ')} to a place in the region`;
};

/** One slot's block: `slot` { key, place, region, realm }, `view` { name, summary, regionName?, menu, facts, conditions, figures }. */
export function slotBlock(slot, view) {
    const lines = [`Slot ${slot.key}`, `Happening: ${view.name} — ${view.summary}`, `Where: ${slot.place} (region ${view.regionName || slot.regionName || slot.region || 'none'}, realm ${slot.realm})`];
    lines.push(`Conditions there now: ${view.conditions.length ? view.conditions.join('; ') : 'none'}`);
    lines.push(`Menu: ${Object.entries(view.menu).map(([key, menu]) => menuLine(key, menu)).join(' | ') || 'nothing (write only the name and summary)'}`);
    if (view.arc) lines.push(arcLine(view.arc));
    if (view.facts.length) lines.push(`Fact you may attach (effects.fact): ${view.facts.join(', ')}`);
    if (view.figures.length) lines.push(`People nearby (ids): ${view.figures.join('; ')}`);
    return lines.join('\n');
}

/** The prompt for a batch: the world's lore once, then each slot; `errors` ({ slotKey: [text] }) on a retry. */
export function openPrompt({ blocks, lore = '', errors = null }) {
    const parts = [lore ? `World lore:\n${lore}` : '', ...blocks];
    if (errors) parts.push(`Your last answer was refused for these slots; answer them again, fixing each error:\n${Object.entries(errors).map(([key, list]) => `${key}: ${list.join(' ')}`).join('\n')}`);
    return parts.filter(Boolean).join('\n\n');
}

/** The answer's text → `{ [slot key]: { name, summary, people, effects, severity?, arc? } }`, or null when it is not the JSON asked for. An answer cut off mid-way gives its whole rows. */
export function readOpenAnswer(text) {
    const raw = String(text ?? '');
    const from = raw.indexOf('{');
    const to = raw.lastIndexOf('}');
    if (from < 0 || to <= from) return null;
    let rows = null;
    try {
        const data = JSON.parse(raw.slice(from, to + 1));
        rows = Array.isArray(data?.results) ? data.results : null;
    } catch { rows = wholeRows(raw); }
    if (!rows?.length) return null;
    const out = {};
    for (const row of rows) {
        if (!row || typeof row !== 'object' || typeof row.slot !== 'string') continue;
        out[row.slot] = { name: row.name, summary: row.summary, people: row.people, effects: row.effects, ...(row.severity !== undefined ? { severity: row.severity } : {}), ...(row.arc !== undefined ? { arc: row.arc } : {}) };
    }
    return out;
}
