// The empty checks state, the policy of a state and its read-only projection.

import { hashJson } from '../../hash.js';
import { isRecord } from './shared-record.js';

export function initialChecks() {
    return { policy: { actors: {}, defaultActor: null }, writes: {}, log: {} };
}

/** The policy of a state (the missing parts read as empty). */
export function policyOf(checks) {
    const policy = isRecord(checks?.policy) ? checks.policy : {};
    return {
        actors: isRecord(policy.actors) ? policy.actors : {},
        defaultActor: typeof policy.defaultActor === 'string' ? policy.defaultActor : null,
    };
}

/** The effective settings the policy hash covers. */
export function effective(settings) {
    return {
        social: settings?.social !== false,
    };
}

/** The read-only projection `checks.policy` answers and `expectedHash` is compared with. */
export function projection(checks, settings) {
    const policy = policyOf(checks);
    const body = {
        actors: Object.fromEntries(Object.keys(policy.actors).sort().map(id => [id, { id, name: policy.actors[id].name, bonuses: Object.fromEntries(Object.keys(policy.actors[id].bonuses ?? {}).sort().map(key => [key, policy.actors[id].bonuses[key]])) }])),
        defaultActor: policy.defaultActor,
        ...effective(settings),
    };
    return { ...structuredClone(body), hash: hashJson(body) };
}
