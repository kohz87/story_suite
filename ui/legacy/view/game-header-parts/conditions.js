// A condition's badge: its icon, its name and the time it has left.

import { TEXT_MAX } from './shared-reads.js';

// A condition's icon, from the icon set (view/icons/set.js). The set has no flame, so burning is a warning, as is any kind not listed.
const CONDITION_ICONS = Object.freeze({ bleeding: 'ph-drop', poison: 'ph-skull', poisoned: 'ph-skull', stunned: 'ph-lightning', dazed: 'ph-lightning', slowed: 'ph-clock' });
export const conditionIcon = kind => CONDITION_ICONS[String(kind ?? '').trim().toLowerCase()] ?? 'ph-warning';

// A condition's name for the badge: its kind with the first letter up ("bleeding" → "Bleeding").
export const conditionLabel = kind => {
    const words = String(kind ?? '').replace(/[_-]+/g, ' ').trim();
    return words ? (words.charAt(0).toUpperCase() + words.slice(1)).slice(0, TEXT_MAX) : '';
};

// A number from an entry's field, or null when it is missing or not one.
const numberOf = value => (value === null || value === undefined || value === '' || !Number.isFinite(Number(value)) ? null : Number(value));

/**
 * What a condition entry says of its time left and the unit it is in: `minutes` (or `until`, a story minute, against `minutesNow`),
 * `left` in the unit it names, or `rounds`. `{ left: null, unit: 'turns' }` when none is given: the badge then shows no count.
 */
export function conditionLeft(entry, minutesNow = null) {
    const minutes = numberOf(entry?.minutes);
    if (minutes !== null) return { left: minutes, unit: 'minutes' };
    const until = numberOf(entry?.until);
    if (until !== null && minutesNow !== null) return { left: Math.max(0, until - minutesNow), unit: 'minutes' };
    const left = numberOf(entry?.left);
    if (left !== null) return { left, unit: ['turns', 'rounds', 'minutes'].includes(entry?.unit) ? entry.unit : 'turns' };
    const rounds = numberOf(entry?.rounds);
    if (rounds !== null) return { left: rounds, unit: 'rounds' };
    return { left: null, unit: 'turns' };
}
