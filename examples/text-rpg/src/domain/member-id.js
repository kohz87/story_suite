// Makes stable, collision-safe member ids from display names.

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
