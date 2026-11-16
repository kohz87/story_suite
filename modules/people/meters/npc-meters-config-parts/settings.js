// Cleaning the reader's meter settings into custom meters, stages and ladders, and building the meter definitions.
import { BUILT_IN_PRESETS, normalizePreset, presetIds } from '../npc-meters-presets.js';
import { BUILT_IN_METERS, BUILT_IN_RANGE, CUSTOM_RANGE, TONES } from './built-in-meters.js';
import { MAX_CUSTOM_METERS, MAX_STAGES_PER_METER } from './limits-counts.js';
import { MAX_RUNGS, MAX_TRACKS } from './limits-ladder.js';
import { DEFAULT_CHANGE_CAP, MAX_CHANGE_CAP, DEFAULT_CONFLICT_AT } from './limits-pacing.js';
import { DEFAULT_DEMOTE_AFTER } from './limits-time.js';
import { MILESTONE_MAX, DESCRIBE_MAX } from './limits-display.js';
import { LABEL_MAX, STAGE_NAME_MAX } from './text-limits.js';
import { TRACK_MAX } from './key-limits.js';
import { REASON_LABELS, FORBIDDEN_KEYS } from './record-words.js';
import { isObject, isInt, clamp } from './values.js';
import { clean, intOr } from './text.js';
import { slug, wordKey } from './slugs.js';
import { parseBands } from './bands.js';
import { parseNeeds } from './needs.js';

const RESERVED_IDS = new Set(['stage', 'stages', 'disposition', 'name', 'meter', 'meters', 'milestone', 'milestones', ...REASON_LABELS]);

// A custom meter row (the reader's or a preset's), cleaned, or null. `taken`: ids already in use.
function customMeter(entry, taken, preset = null) {
    if (!isObject(entry)) return null;
    const label = clean(entry.name ?? entry.label ?? entry.id, LABEL_MAX);
    const id = slug(entry.id || label);
    if (!id || taken.has(id) || RESERVED_IDS.has(id) || FORBIDDEN_KEYS.has(id)) return null;
    let min = clamp(intOr(entry.min, 0), CUSTOM_RANGE.min, CUSTOM_RANGE.max);
    let max = clamp(intOr(entry.max, 100), CUSTOM_RANGE.min, CUSTOM_RANGE.max);
    // An empty or upside-down range (a row just added in the overlay) reads as 0..100.
    if (!(max > min)) { min = 0; max = 100; }
    const start = clamp(intOr(entry.start, clamp(0, min, max)), min, max);
    const show = !(entry.show === false || entry.show === 'hidden' || entry.show === 'no');
    const tone = TONES.includes(entry.tone) ? entry.tone : 'neutral';
    // A longer rule (a pack's may run to 200 characters) is cut at a word, never mid-word.
    const fullRule = clean(entry.describe ?? entry.rule, 400);
    const cutRule = [...fullRule].length > DESCRIBE_MAX ? clean(fullRule, DESCRIBE_MAX).replace(/\s+\S*$/, '') : fullRule;
    const describe = cutRule.replace(/[.;\s]+$/, '');
    const bands = parseBands(entry.bands);
    // Drift: the settings' `drift` (a day) and `driftTo`, or a pack's { toward, perDay }.
    const given = isObject(entry.drift) ? entry.drift : { perDay: entry.drift, toward: entry.driftTo };
    const perDay = clamp(intOr(given.perDay, 0), 0, 100);
    const drift = perDay > 0 ? Object.freeze({ perDay, to: clamp(intOr(given.toward, start), min, max) }) : null;
    taken.add(id);
    return Object.freeze({ id, label: label || id, min, max, start, show, builtIn: false, tone, describe, bands, drift, ...(preset ? { preset } : {}) });
}

// One ladder row, cleaned: { key, name, needs, milestone: { key, name } | null }, or null.
export function rung(entry) {
    if (!isObject(entry)) return null;
    const name = clean(entry.name, STAGE_NAME_MAX);
    const key = wordKey(name);
    const needs = parseNeeds(entry.needs ?? entry.need);
    const milestoneName = clean(entry.milestone, MILESTONE_MAX);
    const milestone = milestoneName && wordKey(milestoneName) ? Object.freeze({ key: wordKey(milestoneName), name: milestoneName }) : null;
    if (!name || !key || (!needs.length && !milestone)) return null;
    const cue = clean(entry.cue, 200);
    return Object.freeze({ key, name, needs, milestone, ...(cue ? { cue } : {}) });
}

/**
 * The reader's meter settings, cleaned: { changeCap, custom: [{ id, label, min, max, start, show,
 * tone, describe, bands, drift }], stages: { [meterId]: [{ at, name }] ascending }, ladder: { [track]:
 * [rung] }, limits: { [track]: { meterId: { ceiling?, floor? } } }, conflictAt, demoteAfter, presets:
 * [ids in use] }. Bad entries are left out, never thrown.
 *   changeCap     the most one meter moves within one reply (story lines and scans together)
 *   customMeters  [{ name (or id), min, max, start, show, tone, describe, bands, drift, driftTo }]: the first six usable ones
 *   stages        [{ meter, at, name }]: up to eight per meter
 *   ladder        [{ name, needs, milestone, track }]: rungs in order; track '' is everyone's
 *   conflictAt    tension above this blocks a promotion
 *   demoteAfter   replies in a row below a rung's needs before it is lost (0: never)
 *   presets       ids of the presets in use (their meters come after the reader's own; their ladder
 *                 runs on a track named by the preset id, with the preset's limits)
 * `options`: { presets: the catalog (presetCatalog), stagesOn (false: no ladder) }.
 */
export function normalizeMeterSettings(raw = {}, { presets = BUILT_IN_PRESETS, stagesOn = true } = {}) {
    const source = isObject(raw) ? raw : {};
    const changeCap = clamp(intOr(source.changeCap, DEFAULT_CHANGE_CAP), 1, MAX_CHANGE_CAP);
    const conflictAt = clamp(intOr(source.conflictAt, DEFAULT_CONFLICT_AT), BUILT_IN_RANGE.min, BUILT_IN_RANGE.max);
    const demoteAfter = clamp(intOr(source.demoteAfter, DEFAULT_DEMOTE_AFTER), 0, 50);
    const custom = [];
    const taken = new Set(BUILT_IN_METERS.map(meter => meter.id));
    for (const entry of Array.isArray(source.customMeters) ? source.customMeters : []) {
        if (custom.length >= MAX_CUSTOM_METERS) break;
        const meter = customMeter(entry, taken);
        if (meter) custom.push(meter);
    }
    // The presets in use, in the order the reader turned them on.
    const catalog = (Array.isArray(presets) ? presets : []).map(preset => (preset?.builtIn !== undefined && Array.isArray(preset.meters) ? preset : normalizePreset(preset, { builtIn: BUILT_IN_PRESETS.includes(preset) }))).filter(Boolean);
    const used = presetIds(source.presets).map(id => catalog.find(preset => preset.id === id)).filter(Boolean);
    for (const preset of used) {
        for (const entry of preset.meters) {
            if (custom.length >= MAX_CUSTOM_METERS) break;
            const meter = customMeter(entry, taken, preset.id);
            if (meter) custom.push(meter);
        }
    }
    const ids = new Map([...BUILT_IN_METERS, ...custom].flatMap(meter => [[meter.id, meter.id], [slug(meter.label), meter.id]]));
    const stages = {};
    for (const entry of Array.isArray(source.stages) ? source.stages : []) {
        if (!isObject(entry)) continue;
        const meter = ids.get(slug(entry.meter));
        const name = clean(entry.name, STAGE_NAME_MAX);
        const at = intOr(entry.at, null);
        if (!meter || !name || at === null) continue;
        const list = stages[meter] ??= [];
        if (list.length >= MAX_STAGES_PER_METER || list.some(stage => stage.at === at)) continue;
        list.push(Object.freeze({ at, name }));
    }
    for (const list of Object.values(stages)) list.sort((a, b) => a.at - b.at);
    const ladder = {};
    const limits = {};
    if (stagesOn) {
        const rows = [
            ...(Array.isArray(source.ladder) ? source.ladder : []).filter(isObject).map(row => ({ ...row, track: clean(row.track, TRACK_MAX) }))
                .filter(row => !FORBIDDEN_KEYS.has(row.track)),
            ...used.flatMap(preset => preset.ladder.map(row => ({ ...row, track: preset.id }))),
        ];
        for (const row of rows) {
            const step = rung(row);
            if (!step) continue;
            if (!Object.hasOwn(ladder, row.track) && Object.keys(ladder).length >= MAX_TRACKS) continue;
            const list = ladder[row.track] ??= [];
            if (list.length >= MAX_RUNGS || list.some(other => other.key === step.key)) continue;
            // A need names a meter by id or label.
            list.push(Object.freeze({ ...step, needs: Object.freeze(step.needs.map(need => Object.freeze({ ...need, meter: ids.get(need.meter) ?? need.meter }))) }));
        }
    }
    for (const preset of used) if (Object.keys(preset.limits).length) limits[preset.id] = preset.limits;
    return { changeCap, custom, stages, ladder, limits, conflictAt, demoteAfter, presets: used.map(preset => preset.id), stagesOn };
}

/**
 * Every meter in use, built-ins first: [{ id, label, min, max, start, show, builtIn, tone, ... }].
 * `baseline` is Delta's base relationship values ({ trust, affection, desire, tension }).
 */
export function meterDefs(settings, baseline = {}) {
    const normalized = settings && Array.isArray(settings.custom) ? settings : normalizeMeterSettings(settings);
    const base = isObject(baseline) ? baseline : {};
    return [
        ...BUILT_IN_METERS.map(meter => Object.freeze({
            ...meter, ...BUILT_IN_RANGE, start: clamp(intOr(base[meter.id], 0), BUILT_IN_RANGE.min, BUILT_IN_RANGE.max), show: true, builtIn: true,
        })),
        ...normalized.custom,
    ];
}
