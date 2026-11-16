// Builds and caches per-pack place and adjacency indexes, plus name normalization.

const INDEXES = new WeakMap();

// Known places are those in `places` and every edge endpoint (some packs link districts
// they never list). Names are compared lowercased, with straight apostrophes.
export function indexOf(pack) {
    let index = INDEXES.get(pack);
    if (index) return index;
    const byKey = new Map();
    const adjacency = new Map();
    const add = name => {
        if (!byKey.has(normalizeName(name))) byKey.set(normalizeName(name), name);
        if (!adjacency.has(name)) adjacency.set(name, []);
    };
    Object.keys(pack.places ?? {}).forEach(add);
    for (const edge of pack.edges ?? []) {
        add(edge.a);
        add(edge.b);
        adjacency.get(edge.a).push(edge);
        adjacency.get(edge.b).push(edge);
    }
    const longestFirst = [...byKey].sort((x, y) => y[0].length - x[0].length);
    index = { byKey, adjacency, longestFirst };
    INDEXES.set(pack, index);
    return index;
}

export function normalizeName(text) {
    return String(text ?? '').replace(/[’‘ʼ`]/g, '\'').replace(/\s+/g, ' ').trim().toLowerCase();
}
