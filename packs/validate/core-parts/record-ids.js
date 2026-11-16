// The job: turning a display name into a slug and a record's slug into its namespaced ID.

import { RECORD_LIMITS } from '../../limits.js';

/** A slug for a display name: "Iron Sword (old)" → "iron-sword-old". */
export function slugify(name) {
    return String(name ?? '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, RECORD_LIMITS.slug).replace(/-+$/, '');
}

export const fullId = (packId, slug) => `pack.${packId}/${slug}`;
