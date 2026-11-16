// A meter's word direction (`trust: up`, `tension: down`) and its price: the step code gives it from the impact word and the caps setting.
import { normalizeRelationshipCaps } from '../../core-mechanics.js';

const BASE_STEP = Object.freeze({ ordinary: 1, meaningful: 2, major: 3 });

/** 'up' or 'down' (the first word, any case; "up (a little)" counts), else null. */
export function directionOf(raw) {
    const word = String(raw ?? '').trim().toLowerCase().split(/[^a-z]+/)[0];
    return word === 'up' ? 1 : word === 'down' ? -1 : null;
}

/** The step of one word move: ordinary 1, meaningful 2, major 3, extreme the caps setting's extreme (never above the tier's own cap). */
export function stepOf(tier, caps) {
    const limits = normalizeRelationshipCaps(caps ?? {});
    return tier === 'extreme' ? limits.extreme : Math.min(BASE_STEP[tier] ?? 1, limits[tier] ?? 1);
}

/** The word moves as meter changes ({ meter, mode: 'add', value }); the reply's cap and the meter's range still apply after (moveMeters, tiered). */
export function wordChanges(words, tier, caps) {
    const step = stepOf(tier, caps);
    return words.map(({ def, dir }) => ({ meter: def.id, mode: 'add', value: dir * step }));
}
