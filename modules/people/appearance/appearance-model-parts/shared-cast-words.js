/* A cast dossier's pack-given words kept whole: which appearance texts use the wide limit. A part of appearance-model.js (same owner, moved without change). */
import { castAppearanceKept } from '../core-mechanics.js';

// A cast dossier still holding the pack's own words (castFrom.first) keeps them whole: the physical text up to 1800 characters and the
// resolved appearance ("<physical>; <wears>") up to the wide limit; every other dossier keeps the usual 800.
export function castWords(raw) {
    const kept = castAppearanceKept(raw);
    return { overall: kept.overall, wide: kept.overall || kept.appearance, resolved: kept.appearance && kept.split };
}
