// World events, the daily step: a pack's events and templates as the step reads them (spec v0.10 §3, §5). The install check
// (packs/validate) owns the full refusal rules; here an event the step cannot read is left out with a warning, never guessed. Pure.

import { anchorString, conditionString, isConditionEntry } from './grammar.js';
import { durationDays } from './durations.js';
import { isThreshold, thresholdProblem, thresholdString } from './threshold.js';

const KINDS = ['one-off', 'chain-stage', 'recurring'];
const CERTAINTY = ['set-in-motion', 'likely', 'possible'];
const GROUP = Object.freeze({ 'set-in-motion': 0, 'chain-stage': 1, 'one-off': 2, recurring: 3 });
const list = value => (Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]);
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function chanceOf(raw) {
    const match = typeof raw === 'string' ? /^(\d{1,3}(?:\.\d+)?)% (over the window|per season)$/.exec(raw.trim()) : null;
    return match ? { percent: Number(match[1]), per: match[2] === 'per season' ? 'season' : 'window' } : null;
}

function modifiers(raw) {
    const out = [];
    for (const [key, value] of Object.entries(isRecord(raw) ? raw : {})) {
        const match = typeof value === 'string' ? /^×(\d+(?:\.\d+)?)$/.exec(value.trim()) : null;
        if (!match) return null;
        out.push({ key, m: Number(match[1]) });
    }
    return out;
}

// A threshold (`power:<id> >= N`, v0.13) is allowed only where `thresholds` is true: requires, requires_any, ends_when.any_of.
function entriesOk(entries, thresholds = false) {
    return entries.every(item => (isThreshold(item) ? thresholds && !thresholdString(item).why : isConditionEntry(item) ? conditionString(item) : anchorString(item)));
}

/** The first threshold in `entries` that is written wrongly → why, else ''. */
const thresholdWhy = entries => entries.filter(isThreshold).map(item => thresholdString(item).why).find(Boolean) ?? '';

/** `ends_when`: "instant" → { instant }; { for?, any_of? } → { for: days, anyOf }; anything else null. */
function endsOf(raw) {
    if (raw === 'instant') return { instant: true, for: null, anyOf: [] };
    if (!isRecord(raw) || (raw.for === undefined && raw.any_of === undefined)) return null;
    const days = raw.for === undefined ? null : durationDays(raw.for);
    if (days === undefined) return null;
    return { instant: false, for: days, anyOf: list(raw.any_of) };
}

/** One raw pack event → `{ def }` or `{ why }`. */
export function readEvent(raw) {
    const id = isRecord(raw) && typeof raw.id === 'string' ? raw.id : null;
    const bad = why => ({ why: `The event "${id ?? '?'}" is not run by the world: ${why}` });
    if (!id) return bad('it has no id.');
    const kind = KINDS.includes(raw.kind) ? raw.kind : 'one-off';
    const certainty = CERTAINTY.includes(raw.certainty) ? raw.certainty : 'possible';
    const ends = endsOf(raw.ends_when);
    if (!ends) return bad('ends_when must be "instant" or { for, any_of }.');
    const requires = list(raw.requires);
    const requiresAny = list(raw.requires_any);
    const why = thresholdWhy([...requires, ...requiresAny, ...ends.anyOf]);
    if (why) return bad(why);
    if (!entriesOk(requires, true) || !entriesOk(requiresAny, true)) return bad('a requires entry is neither a condition "<name>@<ref>", an anchor nor a threshold.');
    if ([...list(raw.pre_empted_by), ...Object.keys(isRecord(raw.likelier_if) ? raw.likelier_if : {}), ...Object.keys(isRecord(raw.less_if) ? raw.less_if : {})].some(isThreshold)) {
        return bad('a threshold (power: / score:) is allowed only in requires, requires_any and ends_when.any_of.');
    }
    let window = null;
    if (raw.window !== undefined) {
        const within = durationDays(raw.window?.within);
        if (!within) return bad('window.within must be a duration such as "40 days".');
        if (raw.window.after !== undefined && !anchorString(raw.window.after)) return bad('window.after must be an anchor.');
        window = { after: raw.window.after ?? null, within };
    }
    const chance = raw.chance === undefined ? null : chanceOf(raw.chance);
    if (raw.chance !== undefined && !chance) return bad('chance must read "20% over the window" or "30% per season".');
    const likelier = modifiers(raw.likelier_if);
    const less = modifiers(raw.less_if);
    if (!likelier || !less) return bad('likelier_if / less_if values are ×N.');
    let cooldown = null;
    if (raw.cooldown !== undefined) {
        const match = /^(.+?)( per place)?$/.exec(String(raw.cooldown).trim());
        const days = match ? durationDays(match[1]) : undefined;
        if (!days) return bad('cooldown must be a duration such as "1 season per place".');
        cooldown = { days, perPlace: Boolean(match[2]) };
    }
    const where = raw.where === 'where conditions fit' ? { fit: true } : isRecord(raw.where) ? { kinds: list(raw.where.kinds), region: raw.where.region ?? null, realm: raw.where.realm ?? null } : { refs: list(raw.where) };
    return {
        def: {
            id, kind, certainty, reach: raw.reach ?? 'regional', severity: raw.severity === 'minor' ? 'minor' : 'major',
            where, requires, requiresAny, window, chance, likelier: [...likelier, ...less], preEmptedBy: list(raw.pre_empted_by),
            outcomes: Array.isArray(raw.outcomes) ? raw.outcomes : [], effects: isRecord(raw.effects) ? raw.effects : {},
            ends, cooldown, summary: typeof raw.summary === 'string' ? raw.summary : id, title: typeof raw.title === 'string' ? raw.title : id,
            anchorMode: raw.anchor_mode === 'each' || raw.anchor_mode === 'first' ? raw.anchor_mode : kind === 'recurring' ? 'each' : 'first',
            group: certainty === 'set-in-motion' ? GROUP['set-in-motion'] : GROUP[kind],
        },
    };
}

/** One raw template → `{ def }` or `{ why }` (only minor templates are rolled by code; majors are the Director's). */
export function readTemplate(raw) {
    const id = isRecord(raw) && typeof raw.template === 'string' ? raw.template : null;
    if (!id) return { why: 'A template has no name ("template").' };
    const needs = list(raw.needs);
    if (!entriesOk(needs)) return { why: `The template "${id}" is not run: a needs entry is neither a condition nor an anchor.` };
    const match = raw.cooldown === undefined ? null : /^(.+?)( per place)?$/.exec(String(raw.cooldown).trim());
    const days = match ? durationDays(match[1]) : null;
    if (raw.cooldown !== undefined && !days) return { why: `The template "${id}" is not run: its cooldown is not a duration.` };
    return {
        def: {
            id, template: true, severity: raw.severity === 'major' ? 'major' : 'minor', scope: raw.scope ?? 'place', reach: raw.reach ?? 'local',
            needs, sets: list(raw.sets), clears: list(raw.clears), chance: raw.chance === undefined ? null : chanceOf(raw.chance),
            cooldown: days ? { days, perPlace: Boolean(match[2]) } : null, summary: typeof raw.summary === 'string' ? raw.summary : id,
            where: isRecord(raw.where) ? { kinds: list(raw.where.kinds) } : null,
        },
    };
}

/** Events and templates of a world → `{ events (by group, then id), templates (by id), warnings }`. */
export function readDefs(world = {}) {
    const warnings = [];
    const events = [];
    const seen = new Set();
    for (const raw of list(world.events)) {
        const out = readEvent(raw);
        if (out.why) { warnings.push(out.why); continue; }
        // A threshold must name a power or score id of this world, with N in its range (v0.13).
        const problem = [...out.def.requires, ...out.def.requiresAny, ...out.def.ends.anyOf].filter(isThreshold).map(text => thresholdProblem(thresholdString(text), world)).find(Boolean);
        if (problem) { warnings.push(`The event "${out.def.id}" is not run by the world: ${problem}`); continue; }
        if (seen.has(out.def.id)) continue;
        seen.add(out.def.id);
        events.push(out.def);
    }
    events.sort((a, b) => a.group - b.group || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const templates = [];
    for (const raw of list(world.templates)) {
        const out = readTemplate(raw);
        if (out.why) warnings.push(out.why);
        else templates.push(out.def);
    }
    templates.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    return { events, templates, warnings };
}
