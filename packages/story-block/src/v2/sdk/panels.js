// sdk.panels: modules mark their panels dirty instead of drawing them, behind the flag `suite.redrawScheduler`.
// A module registers a section (`register`) and says what changed (`changed`); the page's one scheduler (ui-host/redraw-wiring.js) draws
// the section once in the next frame. The hub lives here because modules register before the page mounts; the host binds the scheduler to it.

/**
 * `createPanels({ on })` → `{ panels, bind }`. `panels` is the frozen public face: `{ on, register(id, section) → off, changed(keys), hold() }`.
 * `on` is a getter (read at every use, never cached): false means every call is inert (`register` → a no-op `off`, `changed` and `hold` do nothing),
 * so a module keeps its old paths. A section is the scheduler's: `{ keys, isVisible, read, draw | render, drawn }`; `drawn: true` says it is already on
 * screen, so it is not drawn until something it listens to changes. Its digest also holds the number of `changed` calls for its keys, so
 * a section that was just drawn (its seed counts the calls so far) is not drawn again for a change it already shows.
 * `bind(target)` (the host only, never given to modules) connects `{ register, changed, hold }` of the scheduler (or null to let go);
 * sections registered meanwhile are registered when it binds, and again at the next bind.
 */
export function createPanels({ on = () => false } = {}) {
    const isOn = () => { try { return on() === true; } catch { return false; } };
    const sections = new Map();   // id → { section, off } (off: the scheduler's, while bound)
    const counts = new Map();     // key → number of changed() calls that named it
    let all = 0;                  // changed() calls that named no key, or '*'
    let target = null;

    const revision = keys => {
        if (!Array.isArray(keys) || keys.length === 0 || keys.includes('*')) return all + [...counts.values()].reduce((sum, n) => sum + n, 0);
        return all + keys.reduce((sum, key) => sum + (counts.get(key) ?? 0), 0);
    };
    const attach = (id, entry) => {
        const { section } = entry;
        entry.off = target.register(id, {
            ...section,
            read: () => ({ rev: revision(section.keys), own: typeof section.read === 'function' ? section.read() : undefined }),
        });
    };
    const panels = Object.freeze({
        get on() { return isOn(); },
        register(id, section) {
            if (!isOn() || !section || typeof id !== 'string' || !id) return () => {};
            sections.get(id)?.off?.();
            const entry = { section, off: null };
            sections.set(id, entry);
            if (target) attach(id, entry);
            return () => { if (sections.get(id) === entry) { sections.delete(id); entry.off?.(); entry.off = null; } };
        },
        changed(keys) {
            if (!isOn()) return;
            const named = Array.isArray(keys) ? keys.filter(key => typeof key === 'string' && key) : [];
            if (named.length === 0) all += 1;
            for (const key of new Set(named)) counts.set(key, (counts.get(key) ?? 0) + 1);
            target?.changed(named);
        },
        hold() { return isOn() && target ? target.hold() : () => {}; },
    });
    const bind = next => {
        if (target) for (const entry of sections.values()) { entry.off?.(); entry.off = null; }
        target = next ?? null;
        if (target) for (const [id, entry] of sections) attach(id, entry);
    };
    return { panels, bind };
}
