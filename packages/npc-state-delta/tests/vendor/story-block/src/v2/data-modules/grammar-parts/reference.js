// Names a module in a `dm` line: the bare slug when unique among the active ids, else the full ID.
/** The name a `dm` line uses for module `id` among the active ids: the bare slug when unique, else the full ID. */
export function referenceOf(ids, id) {
    const slug = String(id).split('/')[1];
    return ids.filter(other => String(other).split('/')[1] === slug).length === 1 ? slug : id;
}
