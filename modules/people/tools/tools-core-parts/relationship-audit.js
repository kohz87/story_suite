/* NPC State Delta supporting tools: the relationship diagnostic rows (scores against recorded gate milestones). */
import { plain, safeNumber } from './values.js';

const RELATIONSHIP_AXES = Object.freeze(['trust', 'affection', 'desire', 'tension']);
const RELATIONSHIP_GATE_THRESHOLDS = Object.freeze([25, 50, 75, 90]);

export function relationshipDiagnosticRows(npc = {}) {
    const relationship = npc?.relationship && typeof npc.relationship === 'object' ? npc.relationship : {};
    const progress = npc?.relationshipProgress && typeof npc.relationshipProgress === 'object' ? npc.relationshipProgress : {};
    const milestones = Array.isArray(npc?.relationshipMilestones) ? npc.relationshipMilestones : [];
    return RELATIONSHIP_AXES.map(axis => {
        const score = Math.max(-100, Math.min(100, safeNumber(relationship[axis], 0)));
        const fraction = Math.max(-0.999999, Math.min(0.999999, safeNumber(progress[axis], 0)));
        const direction = score < 0 ? -1 : 1;
        const reached = RELATIONSHIP_GATE_THRESHOLDS.filter(threshold => Math.abs(score) >= threshold);
        const missingReached = reached.filter(threshold => !milestones.some(item => plain(item?.axis) === axis
            && safeNumber(item?.polarity, 0) === direction
            && safeNumber(item?.threshold, 0) === threshold));
        return {
            axis,
            score,
            fractionalProgress: fraction,
            recordedMilestones: milestones.filter(item => plain(item?.axis) === axis).length,
            derivedGateAudit: missingReached.length ? `Missing reached gate record(s): ${missingReached.join(', ')}` : 'Recorded gates consistent with reached thresholds',
        };
    });
}
