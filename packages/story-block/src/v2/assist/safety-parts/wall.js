// The value wall: why one extractor line may not run, and the raw lines of a text the wall lets through.

import { parseChanges } from '../../capture.js';

// Kinds whose `+` line adds value or something only the reader decides, under any setting.
const ADDS = new Set(['item', 'coin', 'coins', 'money', 'gold', 'loot', 'xp', 'exp', 'level', 'reward', 'join', 'skill', 'craft', 'buy', 'sell', 'grant']);
// Kinds never taken from the extractor at all.
const NEVER = new Set(['coin', 'coins', 'money', 'gold', 'loot', 'xp', 'exp', 'level', 'reward', 'buy', 'sell', 'craft', 'grant']);
// Labels that add value whatever the kind (a heal restores HP; a reward or price names coin).
const VALUE_LABELS = ['heal', 'reward', 'price', 'pay', 'paid', 'xp', 'gold', 'coin', 'coins'];
// An item name that is money ("30 gold", "a pouch of coins"): never an extractor's hand-over after send.
const MONEY_WORD = /\b(?:coins?|gold|silver|copper|pennies|penny|crowns?|marks?|bits?|money|wallet|purse)\b/i;

/**
 * Why `line` (a parsed change line: { op, kind, name, labels }) may not run as an extractor line, or ''
 * when it may. `allow`: allowedKinds(). `late`: the line was read after the reader had sent (stricter). `allow` null: the wall alone.
 */
export function refusedWhy(line, allow, { late = false } = {}) {
    const op = String(line?.op ?? '');
    const kind = String(line?.kind ?? '').toLowerCase();
    const labels = line?.labels && typeof line.labels === 'object' ? Object.keys(line.labels).map(key => key.toLowerCase()) : [];
    if (NEVER.has(kind)) return 'the safety net never writes coin, loot or XP';
    if (op === '+' && ADDS.has(kind)) return 'the safety net never adds items, coin or rewards';
    if (op === '?') return 'the safety net never asks for rolls or loot';
    if (labels.some(label => VALUE_LABELS.includes(label))) return 'the safety net never heals or pays';
    if (late) {
        if (op === '+' && kind !== 'present') return 'a line read after you sent never adds anything';
        if (kind === 'quest' && op === '-') return 'a turn-in read after you sent is left to the next reply';
        if (kind === 'item' && MONEY_WORD.test(String(line?.name ?? ''))) return 'a line read after you sent never moves coin';
    }
    if (allow && !allow.has(`${op} ${kind}`)) return `"${op} ${kind}" is not in the safety net's allowed kinds`;
    return '';
}

/** The raw lines of `text` the wall lets through: { lines: raw[], refused: [{ line, why }] }. */
export function safeLines(text, allow, options = {}) {
    const { lines } = parseChanges(String(text ?? ''));
    const kept = [];
    const refused = [];
    for (const line of lines) {
        const why = refusedWhy(line, allow, options);
        if (why) refused.push({ line: line.raw, why });
        else kept.push(line.raw);
    }
    return { lines: kept, refused };
}
