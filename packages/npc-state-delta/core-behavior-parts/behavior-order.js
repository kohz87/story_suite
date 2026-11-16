/* NPC State Delta the display priority order of behavior levers. */
import { behaviorProfileFamily } from './behavior-keys.js';
import { normalizeBehaviorProfile } from './behavior-normalize.js';

function behaviorProfilePriority(value) {
    const family = behaviorProfileFamily(value);
    const priority = {
        disposition: 0,
        cruelty: 1,
        independence: 2,
        care: 3,
        expressiveness: 4,
        conflict: 5,
        threat: 6,
        analytical: 7,
        presentation: 8,
        loyalty: 9,
        drive: 10,
        honesty: 11,
    };
    return Object.prototype.hasOwnProperty.call(priority, family) ? priority[family] : 12;
}

export function orderedBehaviorProfile(value) {
    return normalizeBehaviorProfile(value)
        .map((item, index) => ({ item, index, priority: behaviorProfilePriority(item) }))
        .sort((a, b) => a.priority - b.priority || a.index - b.index)
        .map(entry => entry.item);
}
