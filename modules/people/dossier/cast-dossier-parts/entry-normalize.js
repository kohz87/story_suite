// The pack entry cleaned whole: texts cut and flattened, lists bounded.

import { NAME_MAX } from './limits-cast.js';
import { ALIASES_MAX, TEXT_MAX, WITH_YOU_MAX } from './limits-text.js';
import { STAGES_MAX } from './limits-fields.js';
import { isLegacyEntry, legacyFields } from './entry-legacy.js';
import { castForms, castLinks, castPairs } from './entry-story.js';
import { BUILT_IN_LIMITS, normalizeLevel } from '../../core/core-record-parts/built-in-fields.js';
import { castBehaviour, castMannerisms, castSecrets, castTastes } from './entry-lists.js';
import { castGatedSecrets } from './entry-gated.js';
import { clip, isObject, labelKey, wholeNumber } from './shared-text.js';

// ---- the pack entry, cleaned ----

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

/**
 * The world cast entry, cleaned (texts cut and flattened, lists bounded), or null without a usable name. `nameOf(id)` gives the name of a cast id
 * (the people the entry's ties and key relationships name); without it those two lists are left out. The rows whose person `nameOf` cannot
 * name (not met yet) are `pendingLinks` ({ keyRelationships: [{ id, text }], ties: [{ id, tag }] }), absent when there are none.
 */
export function normalizeEntry(raw, nameOf = null) {
    if (!isObject(raw)) return null;
    const name = clip(raw.name, NAME_MAX);
    if (!name) return null;
    const start = isObject(raw.start) ? raw.start : {};
    const legacy = isLegacyEntry(raw);
    const meters = normalizeMeters(raw.meters);
    const abilities = castPairs(raw.abilities, BUILT_IN_LIMITS.abilities);
    const keepsakes = castPairs(raw.keepsakes, BUILT_IN_LIMITS.keepsakes);
    const links = castLinks(raw, nameOf);
    const level = normalizeLevel(raw.level);
    const age = typeof raw.age === 'number' ? String(raw.age) : raw.age;
    return {
        id: clip(raw.id, 80),
        kind: legacy ? '' : clip(raw.kind, 40),
        name,
        aliases: (Array.isArray(raw.aliases) ? raw.aliases : []).map(alias => clip(alias, NAME_MAX)).filter(alias => alias && labelKey(alias) !== labelKey(name)).slice(0, ALIASES_MAX),
        role: legacy ? clip(raw.about, 300) : clip(raw.role, 120),
        species: clip(raw.species, 60),
        gender: clip(raw.gender, 40),
        age: clip(age, 40),
        apparentAge: clip(raw.apparentAge, 40),
        look: clip(raw.look, TEXT_MAX),
        wears: clip(raw.wears, TEXT_MAX),
        forms: castForms(raw.forms),
        voice: clip(raw.voice, 600),
        personality: clip(raw.personality, 900),
        history: clip(raw.history, 1200),
        behaviour: castBehaviour(raw.behaviour),
        mannerisms: castMannerisms(raw.mannerisms),
        withYou: clip(raw.withYou, WITH_YOU_MAX),
        portrait: clip(raw.portrait, 120),
        ...(clip(raw.birthday, 80) ? { birthday: clip(raw.birthday, 80) } : {}),
        homeBase: legacy ? clip(start.place, 300) : clip(raw.homeBase, 80),
        status: clip(raw.status, 200),
        goal: clip(raw.goal, 500),
        keyRelationships: links.keyRelationships,
        ties: links.ties,
        ...(links.pending.keyRelationships.length || links.pending.ties.length ? { pendingLinks: links.pending } : {}),
        ...(level ? { level } : {}),
        abilities: abilities.list,
        keepsakes: keepsakes.list,
        ...(abilities.extra.length || keepsakes.extra.length ? { overflow: { abilities: abilities.extra, keepsakes: keepsakes.extra } } : {}),
        start: { place: clip(start.place, 300), goal: clip(start.goal, 500), routine: clip(start.routine, 300) },
        drawnTo: (Array.isArray(raw.drawnTo) ? raw.drawnTo : []).map(item => clip(item, 120)).filter(Boolean).slice(0, 8),
        meters,
        stages: normalizeStages(raw.stages),
        fields: legacy ? legacyFields(raw.fields) : {},
        secrets: castSecrets(raw.secrets),
        ...(castGatedSecrets(raw.secrets).length ? { gated: castGatedSecrets(raw.secrets) } : {}),
        tastes: castTastes(raw.tastes),
        drives: isObject(raw.drives) || Array.isArray(raw.drives) ? raw.drives : undefined,
        packVersion: clip(raw.packVersion, 40),
    };
}
