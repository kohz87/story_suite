// The job: "what NPC State seeds" for one world cast entry. It runs the game's own seeding (normalizeCast + applyCastEntry from the
// people module, imported, never copied) on the author's entry and returns the person record the first meeting would make, plus the
// fields the Cast editor shows. Pure: no host, no settings, no network.

import { normalizeCast } from '../../modules/people/dossier/cast-dossier-parts/cast-answer.js';
import { applyCastEntry } from '../../modules/people/dossier/cast-dossier-parts/apply-entry.js';
import { createNpcRecord, normalizeNpcRecord } from '../../modules/people/core/core.js';

/** The record fields a world cast entry fills, in the order the panel lists them. */
export const SEEDED_FIELDS = Object.freeze([
    'role', 'species', 'gender', 'age', 'apparentAge', 'homeBase', 'status', 'level', 'abilities', 'keepsakes', 'keyRelationships',
    'overallAppearance', 'appearance', 'appearanceForms', 'speech', 'personality', 'background', 'behaviorProfile', 'mannerisms',
    'relationshipSummary', 'birthDate', 'goal', 'location', 'relationship', 'meterSetup', 'secrets', 'customFields',
]);

const PACK = 'studio';

/**
 * `entry` is the raw cast entry; `options.cast` is the pack's whole raw cast (ties and key relationships name their people from it),
 * `placeName(id)` names a pack place, `gated` is the "world secrets" setting, `packName` the badge name.
 * Returns { ok: false } for an entry with no usable name, else { ok: true, record, fields, overflow, pendingLinks, stages }.
 */
export function previewSeed(entry, { cast = [], placeName = null, gated = false, packName = '' } = {}) {
    const row = raw => ({ key: `${PACK}:${raw?.id}`, pack: PACK, id: raw?.id, name: raw?.name, aliases: [], met: { on: 0, where: '' }, alive: true, entry: raw });
    const others = (Array.isArray(cast) ? cast : []).filter(raw => raw && raw.id !== entry?.id);
    const person = normalizeCast([row(entry), ...others.map(row)])[0];
    if (!person?.entry || person.id !== entry?.id) return { ok: false };
    const record = normalizeNpcRecord(applyCastEntry(createNpcRecord(person.entry.name, []), person, { packName, gated, placeName }));
    const fields = [];
    for (const field of SEEDED_FIELDS) {
        const value = record[field];
        const empty = value === undefined || value === null || value === '' || (Array.isArray(value) && !value.length)
            || (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length);
        if (!empty) fields.push({ field, value: structuredClone(value) });
    }
    return { ok: true, record, fields, overflow: person.entry.overflow ?? null, pendingLinks: person.entry.pendingLinks ?? null, stages: person.entry.stages };
}
