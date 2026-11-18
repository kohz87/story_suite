// A pack secret's reveal gate (world pack spec §7) read against what is known now. Pure. `and` binds tighter than `or`; no parentheses.
// Terms: `stage >= "Name"|N`, `meter <id> >= N`, anchors (`fired:`, `ended:`, `set:`, `cleared:`, `lapsed:`, `died:`, `departed:`, `fact:`,
// `learned:`), `place:<name>`, `quote:<text>`. `of <id>` forms name the owner: they are read as the owner's own only when `known.owners` (a Set of the owner's ids, lower case) lists that id; naming anyone else is a term this cannot read (false), never the owner's value. With no `owners` given they are read as before.
const JOIN = /\s+(?:and|or)\s+(?=(?:fired|ended|set|cleared|lapsed|died|departed|fact|learned|place|quote):|stage\b|meter\b)/g;
const slug = text => String(text ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '');
const fold = text => String(text ?? '').replace(/\s+/g, ' ').trim().toLowerCase();

/**
 * Whether a gate holds. `known`: { stage: highest stage number reached (0 none), stageOf(name) → number or 0, meter(id) → number or null,
 * anchors: Set of anchor keys, place: the scene's place text, quote(text) → boolean }.
 * A term this cannot read is false, so a gate never opens by mistake.
 */
export function gateHolds(gate, known) {
    if (typeof gate !== 'string' || !gate.trim()) return false;
    const text = gate.trim();
    const terms = text.split(JOIN);
    const groups = [[]];
    const bounds = [...text.matchAll(JOIN)].map(match => match[0].trim());
    terms.forEach((term, at) => {
        groups.at(-1).push(term.trim());
        if (bounds[at] === 'or') groups.push([]);
    });
    return groups.some(group => group.length > 0 && group.every(term => termHolds(term, known)));
}

function termHolds(term, known) {
    let match;
    const other = id => id !== undefined && known.owners instanceof Set && !known.owners.has(id.toLowerCase());
    if ((match = /^stage(?: of ([a-z0-9-]+))?\s*>=\s*(?:"([^"]*)"|(\d+))$/.exec(term))) {
        if (other(match[1])) return false;
        const need = match[2] !== undefined ? known.stageOf?.(match[2]) ?? 0 : Number(match[3]);
        return need >= 1 && (known.stage ?? 0) >= need;
    }
    if ((match = /^meter ([a-z0-9-]+)(?: of ([a-z0-9-]+))?\s*>=\s*(-?\d+)(?: of ([a-z0-9-]+))?$/.exec(term))) {
        if (other(match[2]) || other(match[4])) return false;
        const value = known.meter?.(match[1]);
        return Number.isFinite(value) && value >= Number(match[3]);
    }
    if (term.startsWith('place:')) return slug(known.place) !== '' && slug(known.place) === slug(term.slice(6));   // the scene's place by name or id (a district under it is not read)
    if (term.startsWith('quote:')) return known.quote ? known.quote(term.slice(6).trim()) === true : false;
    return known.anchors instanceof Set && known.anchors.has(term);
}
