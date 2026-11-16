// Reads a short line for each known person the message or the reply before it names, for the foe pre-check's prompt.

import { ask, cut, wordsOf } from './shared-text.js';

/** Bounds, in code points: people per prompt, parts of one line, and the whole line. */
export const KNOWN_LIMITS = Object.freeze({ people: 3, name: 40, role: 60, summary: 100, line: 170, scan: 80 });

// Whether the words of `name` occur, whole and in a row, among `seen` (the message and the reply before it, as words).
export function occurs(name, seen) {
    const wanted = wordsOf(name);
    if (!wanted.length) return false;
    for (let at = 0; at + wanted.length <= seen.length; at += 1) if (wanted.every((word, i) => seen[at + i] === word)) return true;
    return false;
}

/** At most KNOWN_LIMITS.people lines "Name: role; short summary" for the dossiers whose name or alias the text names; [] without NSD or a match. */
export function knownLines(query, ...texts) {
    const names = ask(query, 'npc.known', {});
    if (!Array.isArray(names)) return [];
    const seen = texts.flatMap(wordsOf);
    const lines = [];
    for (const name of names.slice(0, KNOWN_LIMITS.scan)) {
        if (lines.length >= KNOWN_LIMITS.people) break;
        if (typeof name !== 'string') continue;
        const dossier = ask(query, 'npc.dossier', { name });
        if (!dossier || typeof dossier !== 'object') continue;
        const aliases = Array.isArray(dossier.aliases) ? dossier.aliases.filter(alias => typeof alias === 'string') : [];
        if (![name, ...aliases].some(label => occurs(label, seen))) continue;
        const detail = [cut(dossier.role, KNOWN_LIMITS.role), cut(dossier.background, KNOWN_LIMITS.summary)].filter(Boolean).join('; ');
        if (detail) lines.push(cut(`${cut(name, KNOWN_LIMITS.name)}: ${detail}`, KNOWN_LIMITS.line));
    }
    return lines;
}
