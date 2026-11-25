// Makes stable, collision-safe member ids from display names.

/** A companion's id from their name, in the shape ctx.id gives ("ac_" and 8 base-36 characters), so an edit of their join line (a Re-read) keeps it;
 * null when another member holds it already (then the caller makes a fresh one). */
export function companionId(name, taken) {
    let hash = 0x811c9dc5;
    for (const ch of String(name ?? '').trim().toLowerCase()) hash = Math.imul(hash ^ ch.codePointAt(0), 0x01000193) >>> 0;
    const id = `ac_${hash.toString(36).padStart(8, '0').slice(-8)}`;
    return taken && Object.prototype.hasOwnProperty.call(taken, id) ? null : id;
}

/** Slugs a name to at most 40 characters and appends -2, -3, ... until it is unused. */
export function memberId(name, taken) {
    const source = typeof name === 'string' ? name : '';
    let base = source.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40).replace(/-+$/g, '');
    if (!base) base = 'member';

    const used = id => taken instanceof Set
        ? taken.has(id)
        : Boolean(taken && typeof taken === 'object' && Object.prototype.hasOwnProperty.call(taken, id));
    if (!used(base)) return base;

    for (let n = 2; ; n += 1) {
        const suffix = `-${n}`;
        const candidate = `${base.slice(0, 40 - suffix.length).replace(/-+$/g, '')}${suffix}`;
        if (!used(candidate)) return candidate;
    }
}
