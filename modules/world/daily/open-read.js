// World events, open templates (spec v0.14 §5): reads the `open` block of a template, its `fallback` and its `per` budget into the form the step uses.
// The install check (packs/validate) owns the refusals; here a block the step cannot read means the template is not run, never guessed. Pure.

import { durationDays } from './durations.js';

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const list = value => (Array.isArray(value) ? value : value === undefined || value === null ? [] : [value]);
const ids = value => list(value).filter(item => typeof item === 'string' && item.trim()).map(item => item.trim());
const pickOf = raw => (Number.isInteger(raw?.pick) && raw.pick >= 1 && raw.pick <= 8 ? raw.pick : raw?.pick === undefined ? 1 : null);

function standing(raw) {
    const pick = pickOf(raw);
    const of = raw.of === 'any' ? 'any' : ids(raw.of);
    const delta = Array.isArray(raw.delta) && raw.delta.length === 2 && raw.delta.every(Number.isInteger) && raw.delta[0] <= raw.delta[1] && raw.delta[0] >= -10 && raw.delta[1] <= 10 ? raw.delta : null;
    return pick && delta && (of === 'any' || of.length) ? { pick, of, delta } : null;
}

const MENU = {
    powers: standing,
    scores: raw => { const out = standing(raw); return out && out.of !== 'any' ? out : out; },
    set(raw) {
        const pick = pickOf(raw);
        const days = durationDays(raw.for, { open: true });
        return pick && ids(raw.of).length && ['@place', '@region', '@realm'].includes(raw.at) && days !== undefined ? { pick, of: ids(raw.of), at: raw.at.slice(1), for: days } : null;
    },
    clear: raw => (pickOf(raw) && ids(raw.of).length ? { pick: pickOf(raw), of: ids(raw.of) } : null),
    ladder(raw) {
        const step = raw.step === undefined ? 1 : raw.step;
        const direction = raw.direction ?? 'either';
        return ids(raw.of).length >= 2 && Number.isInteger(step) && step >= 1 && step <= 3 && ['up', 'down', 'either'].includes(direction) ? { of: ids(raw.of), step, direction } : null;
    },
    cast(raw) {
        const pick = pickOf(raw);
        const of = raw.of === 'figures' ? 'figures' : ids(raw.of);
        return pick && (of === 'figures' || of.length) && raw.move === '@region' ? { pick, of } : null;
    },
};

/** The `menu` of an open block → `{ powers?, scores?, set?, clear?, ladder?, cast? }`, or `{ why }` for a key it cannot read. */
function readMenu(raw) {
    if (!isRecord(raw)) return { why: 'the menu is missing' };
    const out = {};
    for (const [key, value] of Object.entries(raw)) {
        const read = MENU[key] && isRecord(value) ? MENU[key](value) : null;
        if (!read) return { why: `the menu key "${key}" cannot be read` };
        out[key] = read;
    }
    return out;
}

/** The fallback: the fixed effects in the usual `sets` / `clears` form (no menu, no Director). */
const fallbackOf = raw => (isRecord(raw) ? { sets: list(raw.sets), clears: list(raw.clears) } : null);

/** `per`: "<region|place|realm> per <duration>" (one slot per that scope in that time); the default is one slot per region per season. */
function perOf(raw) {
    const match = raw === undefined ? ['', 'region', '1 season'] : /^(region|place|realm) per (.+)$/.exec(String(raw).trim());
    // "region per season" (a bare unit) is one of it, as the install check reads it.
    const days = match ? durationDays(/^(day|week|month|season|year)s?$/i.test(match[2].trim()) ? `1 ${match[2].trim()}` : match[2]) : undefined;
    return match && days ? { by: match[1], days } : null;
}

/**
 * A template's raw `open`, `fallback` and `per` → `{ open: { menu, facts }, fallback, per }`, `{ none: true }` for a template with no `open`
 * (it is run as before), or `{ why }` when the block cannot be read.
 */
export function readOpen(raw) {
    if (raw.open === undefined) return { none: true };
    if (!isRecord(raw.open)) return { why: 'open must be an object' };
    const menu = readMenu(raw.open.menu);
    if (menu.why) return menu;
    const per = perOf(raw.per);
    if (!per) return { why: 'per must read "region per season"' };
    // `arc: { steps: [low, high] }` (generated arcs, spec §5): the open template may start an arc of that many steps, the opening happening counted.
    const arc = raw.arc !== undefined && Array.isArray(raw.arc?.steps) && raw.arc.steps.length === 2 && raw.arc.steps.every(n => Number.isInteger(n) && n >= 2 && n <= 4) && raw.arc.steps[0] <= raw.arc.steps[1] ? { steps: [...raw.arc.steps] } : null;
    return { open: { menu, facts: ids(raw.open.writes_facts), ...(arc ? { arc } : {}) }, fallback: fallbackOf(raw.fallback), per };
}
