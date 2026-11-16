/* Finding, testing and repairing physical-trait swaps against the record. A part of appearance-physical.js (same owner, moved without change). */
import { addressedTraitKeys } from './segments.js';
import { TRAIT_AXES, axisSwapped, axisWords } from './swap-axes.js';
import { traitPieces, valueWords } from './trait-pieces.js';
import { normalizeName } from '../../core/core-text.js';
import { appearanceText, sameAppearance } from '../appearance-text.js';

/**
 * The physical traits `incoming` swaps against `current` (card traits win): [{ trait, said, kept }] in trait order, where `said`
 * is what the incoming text calls it and `kept` what the record holds ("eyes", "pale", "brown"); [] when nothing is swapped.
 */
export function physicalTraitSwaps(current, incoming, replaceable = null) {
    const before = traitPieces(current);
    const after = traitPieces(incoming);
    if (!before.length || !after.length) return [];
    const swaps = [];
    for (const [trait, axes] of Object.entries(TRAIT_AXES)) {
        if (replaceable?.has(trait)) continue;   // a fill guess (record.lookGuess) is replaceable by a later story line
        const now = valueWords(before, trait);
        const next = valueWords(after, trait);
        if (!now.length || !next.length) continue;
        // A jaw is not a nose: compare facial shapes only when the same feature is named.
        if (trait === 'face') {
            const features = ['face', 'facial', 'jaw', 'jawline', 'cheekbones', 'nose', 'lips', 'beard', 'mustache', 'moustache', 'stubble'];
            if (!features.some(feature => now.includes(feature) && next.includes(feature))) continue;
        }
        const axis = axes.find(name => axisSwapped(name, now, next));
        if (!axis) continue;
        const said = axisWords(axis, next).filter(word => !now.includes(word));
        const kept = axisWords(axis, now).filter(word => !next.includes(word));
        swaps.push({ trait, said: said.join(' ') || axisWords(axis, next).join(' '), kept: kept.join(' ') || axisWords(axis, now).join(' ') });
    }
    return swaps;
}
/** True when `incoming` swaps a named physical value of `current`; with `traits` (a Set of trait keys), only one of those. */
export function physicalTraitSwapped(current, incoming, traits = null, replaceable = null) {
    return physicalTraitSwaps(current, incoming, replaceable).some(swap => !traits || traits.has(swap.trait));
}
/** (card traits win) Repair only separable conflicting claims; refuse an ambiguous shared clause. */
export function withoutTraitSwaps(current, incoming, replaceable = null) {
    const swaps = physicalTraitSwaps(current, incoming, replaceable);
    if (!swaps.length) return { text: incoming, swaps };
    const text = appearanceText(incoming);
    const swapped = new Set(swaps.map(swap => swap.trait));
    const held = traitPieces(current);
    const used = new Set();
    const parts = text.split(/(\s*;\s*|(?<=[.!?])\s+|\s*,\s*)/);
    for (let index = 0; index < parts.length; index += 2) {
        const pieces = parts[index].split(/\s+and\s+/i);
        const separable = pieces.length > 1 && pieces.slice(0, -1).every(piece => addressedTraitKeys(piece).length);
        const candidates = separable ? pieces : [parts[index]];
        for (let part = 0; part < candidates.length; part += 1) {
            const conflicts = physicalTraitSwaps(current, candidates[part], replaceable);
            if (!conflicts.length) continue;
            const keys = traitPieces(candidates[part]).flatMap(piece => piece.keys);
            if (keys.some(key => !conflicts.some(swap => swap.trait === key)) || (!separable && /\s+(?:and|with)\s+/i.test(candidates[part]))) return { text: '', swaps };
            const own = held.filter(piece => !used.has(piece.text) && piece.keys.some(key => conflicts.some(swap => swap.trait === key)));
            if (!own.length) return { text: '', swaps };
            own.forEach(piece => used.add(piece.text));
            const tail = candidates[part].match(/[.!?]+$/)?.[0] || '';
            candidates[part] = `${own.map(piece => piece.text).join(', ')}${tail}`;
        }
        parts[index] = candidates.join(' and ');
    }
    // Rejoin with each kept clause's own separator; a clause given way to without a held one is dropped with it.
    let joined = '';
    for (let index = 0; index < parts.length; index += 2) {
        if (parts[index].trim()) joined += (joined ? (parts[index - 1] ?? ' ') : '') + parts[index];
    }
    const repaired = appearanceText(joined);
    const usable = repaired && !physicalTraitSwapped(current, repaired, swapped, replaceable) && !sameAppearance(current, repaired)
        && normalizeName(repaired) !== normalizeName(current);
    return { text: usable ? repaired : '', swaps };
}
