// The words for a fired gate: the ordinal, the one-line tail cue and the receipt.
import { APPROACH_LABEL } from './kinds.js';
import { GATE_MODES } from './gate-rules.js';

const CUE_NAME_MAX = 80;

/** "1st", "2nd", "3rd", "4th", "11th", "21st" ... */
export function ordinalWord(n) {
    if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
    return `${n}${['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
}

/** The cue name: control characters and extra spaces removed, at most CUE_NAME_MAX code points, never empty. */
function cueName(name) {
    const text = String(name ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    return Array.from(text).slice(0, CUE_NAME_MAX).join('') || 'Someone';
}

/** The one-line tail cue for a fired gate, or '' when none fired. No pronoun: the NPC's name is the subject. */
export function gateCue({ mode, via, name }) {
    const label = APPROACH_LABEL[via];
    if (!label) return '';
    const who = cueName(name);
    if (mode === 'back') return `${who} has noticed the repeated ${label}; it backfires.`;
    if (mode === 'susp') return `${who} reads the ${label} as pressure, not warmth.`;
    if (mode === 'less') return `${who} has heard this ${label} before; it lands less.`;
    return '';
}

/** The receipt words for a gate: "via praise · 3rd in 2 days · backfired" ('' when none fired). */
export function describeGate(gate) {
    if (!gate || !Object.hasOwn(GATE_MODES, gate.mode)) return '';
    const parts = [`via ${gate.via}`];
    if (gate.n > 1) parts.push(`${ordinalWord(gate.n)} in ${gate.span} ${gate.span === 1 ? 'day' : 'days'}`);
    parts.push(GATE_MODES[gate.mode]);
    return parts.join(' · ');
}
