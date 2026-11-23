// What a use of a skill teaches: the points of a roll or of a costed skill used without one, scaled by how the threat compares with the hero.
import { practiceGain } from './growth.js';

const THREAT_MULTIPLIERS = Object.freeze([0, 0.5, 1, 1.5, 2, 2]);

/** The practice a costed skill used without a roll (`~ spend`) teaches before the threat scales it. */
export const SPEND_PRACTICE = 5;

/** The practice from one use, scaled by the threat index (far beneath ×0, beneath ×0.5, fair ×1, above ×1.5, far above and beyond ×2; none known: ×1), rounded, at least 1 when it is more than 0. */
export function practiceFor(points, threat) {
    const known = Number.isInteger(threat) && threat >= 0 && threat <= 5;
    const scaled = points * (known ? THREAT_MULTIPLIERS[threat] : 1);
    return scaled > 0 ? Math.max(1, Math.round(scaled)) : 0;
}

/** The practice a `? try` teaches: its band and difficulty (growth.js), scaled by the threat. */
export function rollPractice(band, difficultyIndex, threat) {
    return practiceFor(practiceGain(band, difficultyIndex), threat);
}
