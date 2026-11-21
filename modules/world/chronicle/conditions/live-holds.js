// The conditions table as the readers see it (switch story-director.world-events; WORLDEV finding 1): an event hold counts only while the daily
// step's state says that event is Active. The table is written as patches, so after an edited Re-read or a middle delete of a reply whose step
// ended an event, its hold can come back on the raw entry while the recorded step state says the event ended; read raw, the condition would show
// as active until the next stepped day releases it. Holds are only ever written by fired events (daily/fire.js), so their ids are event ids. An
// entry whose every hold is dead keeps holding only by its own timer or open setter. Nothing is written: the next stepped day still tidies it. Pure.

const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);

/** `table` with each entry's dead holds left out (an entry with no holder left is left out); the table itself when nothing changes or there is no step state. */
export function liveTable(table, daily) {
    const rows = isRecord(daily?.events) ? daily.events : null;
    if (!rows || !isRecord(table)) return table ?? {};
    const dead = id => isRecord(rows[id]) && rows[id].state !== 'active';
    let out = null;
    for (const [key, entry] of Object.entries(table)) {
        if (!Array.isArray(entry?.holds) || !entry.holds.some(dead)) continue;
        out ??= { ...table };
        const holds = entry.holds.filter(id => !dead(id));
        if (holds.length) out[key] = { ...entry, holds };
        else if (entry.open === true || Number.isInteger(entry.fadesAt)) {
            const { holds: _gone, open, ...plain } = entry;
            // An open setter with no end keeps it as an "until cleared" entry; a timer runs on.
            out[key] = open === true ? { ...plain, fadesAt: null } : plain;
        } else delete out[key];
    }
    return out ?? table;
}
