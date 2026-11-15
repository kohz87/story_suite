// Scaling the pull scores by strength and building the dossier drive rows.
import { DRIVE_MAX, DRIVE_DEFAULT } from './shared-limits.js';
import { DRIVES } from './shared-table.js';
import { KEYS, isStrength, defaults } from './shared-strength.js';
import { readExtras } from './extras.js';

const WORDS = Object.freeze(['off', 'low', 'normal', 'high']);
const MULTIPLIERS = Object.freeze([0, 0.5, 1, 1.5]);

// The pull code's multiplier for one strength: 0 mutes the instinct, 2 (default) leaves it as it is.
export function strengthMultiplier(strength) {
    return isStrength(strength) ? MULTIPLIERS[strength] : 1;
}

// One instinct score (0..3) scaled by its strength, rounded and kept in 0..3.
export function applyStrength(score, strength) {
    if (!Number.isFinite(score)) return 0;
    const base = Math.max(0, Math.min(DRIVE_MAX, Math.floor(score)));
    return Math.max(0, Math.min(DRIVE_MAX, Math.round(base * strengthMultiplier(strength))));
}

// The per-NPC instinct values with each one scaled by its drive (only the keys the instinct object carries are kept).
export function scaledInst(inst, drives) {
    const strengths = drives && typeof drives === 'object' ? drives : defaults();
    const out = {};
    if (!inst || typeof inst !== 'object') return out;
    for (const key of Object.keys(inst)) {
        if (KEYS.has(key)) out[key] = applyStrength(inst[key], strengths[key]);
    }
    return out;
}

// The dossier rows, always in DRIVES order: { kind, key, label, strength, word, note } with word off | low | normal | high and `note`
// the short source line shown when the drive is not normal ('' otherwise, or when the leaf holds no source).
export function driveRows(drives, leaf) {
    const strengths = drives && typeof drives === 'object' ? drives : defaults();
    const extras = readExtras(leaf);
    return DRIVES.map(drive => {
        const strength = isStrength(strengths[drive.key]) ? strengths[drive.key] : DRIVE_DEFAULT;
        return { kind: drive.kind, key: drive.key, label: drive.label, strength, word: WORDS[strength], note: strength === DRIVE_DEFAULT ? '' : noteOf(extras[drive.key]) };
    });
}

function noteOf(extra) {
    if (!extra) return '';
    if (extra.s === 'p') return 'set by the pack';
    if (extra.s === 'd') return 'from their description';
    if ((extra.s === 'u' || extra.s === 'l') && extra.n) return `${extra.s === 'u' ? 'grew' : 'eased'} over ${extra.n} story moments${extra.c ? ` (${extra.c})` : ''}`;
    return '';
}
