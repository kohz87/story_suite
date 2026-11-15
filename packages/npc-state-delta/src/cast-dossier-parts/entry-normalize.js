// The pack entry cleaned whole: texts cut and flattened, lists bounded.

import { NAME_MAX } from './limits-cast.js';
import { ALIASES_MAX, TEXT_MAX, WITH_YOU_MAX } from './limits-text.js';
import { FIELDS_MAX, FIELD_NAME_MAX, FIELD_VALUE_MAX, STAGES_MAX } from './limits-fields.js';
import { castBehaviour, castMannerisms, castSecrets, castTastes } from './entry-lists.js';
import { clip, isObject, labelKey, wholeNumber } from './shared-text.js';

// ---- the pack entry, cleaned ----

function normalizeFields(raw) {
    const entries = Array.isArray(raw) ? raw.map(item => [item?.name ?? item?.field, item?.value]) : Object.entries(isObject(raw) ? raw : {});
    const out = {};
    for (const [key, value] of entries) {
        const name = clip(key, FIELD_NAME_MAX);
        const text = clip(typeof value === 'number' ? String(value) : value, FIELD_VALUE_MAX);
        if (!name || !text || Object.keys(out).some(other => other.toLowerCase() === name.toLowerCase())) continue;
        out[name] = text;
        if (Object.keys(out).length >= FIELDS_MAX) break;
    }
    return out;
}

// A stage row in the pack's meterPresets shape, { id, name, needs: [{ meter, at }], milestone }: the needs are met by the meters alone
// and `milestone` is the line the story is told when the stage is first reached (a rung's `cue`, never a milestone it needs). A
// text `needs` ("trust 40, loyalty 50") and a { meter, at, name } threshold are read too.
function normalizeStages(raw) {
    const out = [];
    for (const row of Array.isArray(raw) ? raw : []) {
        if (!isObject(row) || out.length >= STAGES_MAX) continue;
        const name = clip(row.name, 40);
        let needs = row.needs ?? row.need;
        if ((needs === undefined || needs === null) && row.meter !== undefined && wholeNumber(row.at) !== null) needs = [{ meter: row.meter, at: wholeNumber(row.at) }];
        if (!name || needs === undefined || needs === null) continue;
        if (!Array.isArray(needs) && !isObject(needs)) needs = clip(needs, 120);
        const cue = clip(row.cue ?? row.milestone, 200);
        out.push({ name, needs: JSON.parse(JSON.stringify(needs)), ...(cue ? { cue } : {}) });
    }
    return out;
}

function normalizeMeters(raw) {
    if (!isObject(raw)) return { preset: '', values: {} };
    const values = {};
    let preset = '';
    for (const [name, value] of Object.entries(raw).slice(0, 40)) {
        const id = clip(name, 40);
        if (!id || ['__proto__', 'constructor', 'prototype'].includes(id)) continue;
        if (id === 'preset') { preset = clip(value, 80); continue; }
        const number = wholeNumber(value);
        if (number !== null) values[id] = Math.max(-1000, Math.min(1000, number));
    }
    return { preset, values };
}

/** The pack entry, cleaned (texts cut and flattened, lists bounded), or null without a usable name. */
export function normalizeEntry(raw) {
    if (!isObject(raw)) return null;
    const name = clip(raw.name, NAME_MAX);
    if (!name) return null;
    const start = isObject(raw.start) ? raw.start : {};
    const meters = normalizeMeters(raw.meters);
    return {
        id: clip(raw.id, 80),
        name,
        aliases: (Array.isArray(raw.aliases) ? raw.aliases : []).map(alias => clip(alias, NAME_MAX)).filter(alias => alias && labelKey(alias) !== labelKey(name)).slice(0, ALIASES_MAX),
        about: clip(raw.about, 300),
        look: clip(raw.look, TEXT_MAX),
        wears: clip(raw.wears, TEXT_MAX),
        voice: clip(raw.voice, 600),
        personality: clip(raw.personality, 900),
        history: clip(raw.history, 1200),
        behaviour: castBehaviour(raw.behaviour),
        mannerisms: castMannerisms(raw.mannerisms),
        withYou: clip(raw.withYou, WITH_YOU_MAX),
        portrait: clip(raw.portrait, 120),
        ...(clip(raw.birthday, 80) ? { birthday: clip(raw.birthday, 80) } : {}),
        start: { place: clip(start.place, 300), goal: clip(start.goal, 500), routine: clip(start.routine, 300) },
        drawnTo: (Array.isArray(raw.drawnTo) ? raw.drawnTo : []).map(item => clip(item, 120)).filter(Boolean).slice(0, 8),
        meters,
        stages: normalizeStages(raw.stages),
        fields: normalizeFields(raw.fields),
        secrets: castSecrets(raw.secrets),
        tastes: castTastes(raw.tastes),
        drives: isObject(raw.drives) || Array.isArray(raw.drives) ? raw.drives : undefined,
        packVersion: clip(raw.packVersion, 40),
    };
}
