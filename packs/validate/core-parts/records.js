// The job: reading one content list of a pack (unique slugs, each record's own check) and passing open records through.

import { LIMITS, SLUG } from '../../limits.js';
import { oneLine } from '../../../core/text.js';
import { isObject } from './shapes.js';
import { slugify, fullId } from './record-ids.js';

// One content list: every record an object, a unique slug, the record's own check.
// `slugField`: the record's own slug field (`slug`, or `id` for events, races and talents);
// `named`: the record needs a name (always for `slug` records); `autoSlug(record)`: the slug of a
// record without a name (routes) when it gives none.
export function records(list, kind, { add, packId, check, slugField = 'slug', named = slugField === 'slug', autoSlug = null }) {
    if (list === undefined) return [];
    if (!Array.isArray(list)) {
        add('BAD_CONTENT', `content.${kind}`, `content.${kind} must be a list.`);
        return [];
    }
    const out = [];
    const seen = new Set();
    list.forEach((record, index) => {
        const path = `content.${kind}[${index}]`;
        if (!isObject(record)) return add('BAD_RECORD', path, `${path} must be an object.`);
        const label = typeof record.name === 'string' ? `"${record.name}"` : path;
        if (named) {
            if (typeof record.name !== 'string' || !record.name.trim() || record.name.length > LIMITS.name) return add('BAD_RECORD', `${path}.name`, `${path} needs a name of 1 to ${LIMITS.name} characters.`);
        }
        const given = record[slugField];
        let slug;
        if (given !== undefined || (!named && !autoSlug)) {
            if (typeof given !== 'string' || !SLUG.test(given)) return add('BAD_RECORD', `${path}.${slugField}`, `${label}: ${slugField} must be lowercase letters, digits and dashes (like "iron-sword").`);
            slug = given;
        } else if (!named) {
            slug = autoSlug(record);
            if (!slug) return add('BAD_RECORD', path, `${label}: give a "${slugField}".`);
        } else {
            slug = slugify(record.name);
            if (!slug) return add('BAD_RECORD', `${path}.name`, `${label}: the name needs at least one letter or digit, or give a "slug".`);
        }
        if (seen.has(slug)) return add('DUPLICATE', path, `${label}: two ${kind} share the slug "${slug}".`);
        seen.add(slug);
        const normalized = check(record, path, label);
        if (normalized) out.push({ ...normalized, id: fullId(packId, slug), slug, pack: packId });
    });
    return out;
}

// Records whose fields another part owns (creatures, quests …): any plain data, kept as is.
export function openRecord(record) {
    const { slug: _slug, id: _id, pack: _pack, ...rest } = record;
    return { ...rest, name: oneLine(record.name, LIMITS.name) };
}
