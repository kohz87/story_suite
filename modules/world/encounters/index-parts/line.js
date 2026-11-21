// The narrator's one line for a rolled encounter (prompt-only, rides the reply's receipt as the pulse's line does). PROPOSED WORDING:
// behind the switch (default off) until the owner approves it (ENCOUNTERS report). Pure.

const MAX = 320;
const LEAN = 'Show them in passing; they need not speak, and they decide nothing for you.';
const clean = value => String(value ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();

/** The line for a result `{ kind, who, look, place, seen, name }`: '' for quiet, a skip or no one. */
export function encounterLine(entry) {
    if (!entry || !['backdrop', 'cast'].includes(entry.kind) || !clean(entry.who)) return '';
    const where = clean(entry.place) ? ` (${clean(entry.place)})` : '';
    let body;
    if (entry.kind === 'cast') body = `${clean(entry.who)} crosses your path${where}, going about their own day. ${LEAN}`;
    else if (entry.name) body = `${clean(entry.name)}, ${clean(entry.who)}${where}. ${LEAN}`;
    else {
        const look = clean(entry.look) ? ` — ${clean(entry.look)}` : '';
        const again = entry.seen > 0 ? ' Seen here before: keep them the same person.' : '';
        body = `${clean(entry.who)}${where}${look}.${again} ${LEAN}`;
    }
    const line = `Encounter this reply: ${body}`;
    return line.length <= MAX ? line : `${line.slice(0, MAX - 1).replace(/\s+\S*$/, '')}…`;
}
