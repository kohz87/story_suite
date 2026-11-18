// A test stand-in for the scheduler the sdk.panels hub is bound to: `{ register, changed, hold }` and a frame the test runs by hand.
// A section is drawn in a frame when something it listens to changed and its digest (read()) moved since it was last drawn; a section
// registered with `drawn: true` is seeded at its digest then, so a change it already shows draws nothing.

const digest = section => JSON.stringify(section.read());

export function panelsTarget() {
    const entries = new Map();
    let holds = 0;
    const target = {
        register(id, section) {
            const entry = { section, dirty: section.drawn !== true, seen: section.drawn === true ? digest(section) : null };
            entries.set(id, entry);
            return () => { if (entries.get(id) === entry) entries.delete(id); };
        },
        changed(keys) {
            for (const entry of entries.values()) {
                const wanted = entry.section.keys ?? [];
                if (!keys?.length || !wanted.length || wanted.some(key => keys.includes(key))) entry.dirty = true;
            }
        },
        hold() {
            holds += 1;
            let released = false;
            return () => { if (!released) { released = true; holds -= 1; } };
        },
    };
    const frame = () => {
        if (holds > 0) return;
        for (const entry of [...entries.values()]) {
            if (!entry.dirty) continue;
            entry.dirty = false;
            const now = digest(entry.section);
            if (now !== entry.seen) { entry.seen = now; entry.section.draw(); }
        }
    };
    return { target, frame };
}
