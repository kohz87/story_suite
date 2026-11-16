// Folds numbered kind families (learn-1 … learn-5) into one template line plus a closing line.
import { kindGrammar } from './kind-lines.js';

// Kinds that come in a numbered family (learn-1 … learn-5, set-slot-1 … set-slot-4) share one template line: the same line, "kind: learn-N", and one
// closing line that says what N is. A family needs three or more kinds numbered 1..k with the same op and labels; anything else is written kind by kind.
// This is the text the narrator reads and nothing else: every kind of the family is still accepted under its own name (data-modules/part.js reads the
// definition, never this text).
const FAMILY = /^(.+)-(\d+)$/u;
export function familyLines(definition, names, reference, seen) {
    const rows = names.map(name => {
        const line = kindGrammar(definition, name, reference, null), match = FAMILY.exec(name);
        return { name, line, base: match?.[1] ?? null, n: match ? Number(match[2]) : null };
    });
    // (the template is the line with N for the number, so two kinds join a family only when everything else about them reads the same)
    const templated = row => row.base === null ? null : row.line.replace(`kind: ${row.name}`, `kind: ${row.base}-N`);
    const groups = new Map();
    for (const row of rows) {
        const key = templated(row);
        if (key !== null) groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const family = new Map();
    for (const [key, members] of groups) {
        const numbers = members.map(member => member.n).sort((a, b) => a - b);
        if (members.length >= 3 && numbers.every((n, at) => n === at + 1)) family.set(key, members);
    }
    const lines = [], notes = [], done = new Set();
    for (const row of rows) {
        const key = templated(row), members = family.get(key);
        if (!members) { lines.push(seen ? kindGrammar(definition, row.name, reference, seen) : row.line); continue; }
        if (done.has(key)) continue;
        done.add(key);
        // (the first member's line, with its number made N, so the list of values is the one `seen` knows)
        const first = members.find(member => member.n === 1);
        lines.push((seen ? kindGrammar(definition, first.name, reference, seen) : first.line).replace(`kind: ${first.name}`, `kind: ${first.base}-N`));
        notes.push({ base: first.base, last: members.length });
    }
    // One closing line per size: "N = 1..5 for learn-N and practice-N."
    for (const size of [...new Set(notes.map(note => note.last))]) {
        const bases = notes.filter(note => note.last === size).map(note => `${note.base}-N`);
        lines.push(`N = 1..${size} for ${bases.length > 1 ? `${bases.slice(0, -1).join(', ')} and ${bases.at(-1)}` : bases[0]}.`);
    }
    return lines;
}
