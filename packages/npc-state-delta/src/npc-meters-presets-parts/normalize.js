// One preset from a built-in or pack record, cleaned (name, id, meters, ladder and limits).
import { clean, isObject, presetSlug } from './shared-text.js';
import { ID_MAX, PRESET_LADDER_MAX } from './shared-limits.js';
import { normalizeLimits } from './limits.js';

const NAME_MAX = 40;
const DESCRIBE_MAX = 160;

/**
 * One preset from a built-in or pack record, cleaned: { id, name, describe, builtIn, meters, ladder,
 * limits }, or null when it has no name or nothing in it. `id`: the record's own (a pack's
 * `pack.<pack>/<slug>`), else its name's slug.
 */
export function normalizePreset(raw, { builtIn = false } = {}) {
    if (!isObject(raw)) return null;
    const name = clean(raw.title ?? raw.name, NAME_MAX);
    const given = typeof raw.id === 'string' ? clean(raw.id, ID_MAX) : '';
    const id = given && /^[\p{L}\p{N}][\p{L}\p{N}._/-]*$/u.test(given) ? given : presetSlug(raw.slug || name);
    if (!name || !id) return null;
    const meters = (Array.isArray(raw.meters) ? raw.meters : []).filter(isObject).slice(0, 6).map(meter => ({ ...meter }));
    // A built-in rung's `milestone` is a story milestone it needs. A pack's stage (Story Block
    // PACKS.md `meterPresets`) is reached on its needs alone; its `milestone` is the line the story is
    // told when the stage is first reached (kept as the rung's `cue`).
    const ladder = (Array.isArray(raw.ladder ?? raw.stages) ? (raw.ladder ?? raw.stages) : []).filter(isObject).slice(0, PRESET_LADDER_MAX)
        .map(rung => ({
            name: clean(rung.name, NAME_MAX),
            needs: typeof rung.needs === 'string' ? clean(rung.needs, 120) : rung.needs,
            ...(builtIn ? { milestone: clean(rung.milestone, 60) } : { cue: clean(rung.cue ?? rung.milestone, 200) }),
        }))
        .filter(rung => rung.name);
    const limits = normalizeLimits(raw.limits);
    if (!meters.length && !ladder.length && !Object.keys(limits).length) return null;
    const pack = typeof raw.pack === 'string' ? clean(raw.pack, ID_MAX) : '';
    return { id, name, describe: clean(raw.describe ?? raw.description, DESCRIBE_MAX), builtIn, meters, ladder, limits, ...(pack ? { pack } : {}) };
}
