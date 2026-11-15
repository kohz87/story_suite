// Pack events, the pack's event list: reads the event definitions of the enabled packs from a view.

/** Event definitions from the enabled packs. */
export function packEvents(view) {
    if (typeof view?.query !== 'function') return [];
    const list = view.query('packs.content', { kind: 'events' });
    return Array.isArray(list) ? list : [];
}
