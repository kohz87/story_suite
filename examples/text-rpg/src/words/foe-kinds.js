// The foe kind ladder the narrator writes (`kind: vermin … legend`) and the plain words the reader and the narrator are shown for what the code made of it.

/** The kinds, weakest first: vermin (rats, stray dogs), common (bandit, wolf), trained (soldier, guard), elite (veteran knight, troll), monster (ogre chief, wyvern), legend (dragon). */
export const KINDS = Object.freeze(['vermin', 'common', 'trained', 'elite', 'monster', 'legend']);

// The threat index (far beneath … beyond) in plain terms.
const PLAIN = ['trivial for you', 'minor for you', 'even for you', 'above you', 'far above you', 'beyond you'];

/** The kind a text names (any case, spaces trimmed), or null. */
export function readKind(text) {
    const word = String(text ?? '').trim().toLowerCase();
    return KINDS.includes(word) ? word : null;
}

/** "vermin, minor for you" (a group from an old chat has no kind: just "minor for you"). */
export const foeWords = (kind, threat) => [KINDS.includes(kind) ? kind : '', PLAIN[threat] ?? ''].filter(Boolean).join(', ');

/** "Rats: vermin, minor for you (24)": a group as the card, the matchup line and the receipts show it. */
export const foeLine = (name, kind, threat, count) => `${name}: ${foeWords(kind, threat)} (${count})`;
