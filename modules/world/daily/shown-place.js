// World events, the daily step: the place a code-written happening's text names (LAB2-2). A happening placed at a part of a town
// ("Bluewatch Village / Guild Office", a pack's sub-place) is a happening of the town: its text names the town, or the region when
// the pack does not have the town. The happening's own place (where its news starts) is unchanged. Pure.

const low = value => String(value ?? '').trim().toLowerCase();

/** The name `{place}` stands for in a template's text: the place's town for a sub-place, else the region, else the place as given. */
export function textPlace(geo, name, regionName = '') {
    const own = geo?.byName?.get(low(name));
    if (own?.parent) return own.parent;
    if (!/ \/ /.test(String(name ?? ''))) return String(name ?? '');
    return regionName || own?.regionName || String(name ?? '');
}
