// The standalone checks domain, actor policy, and roll history.
// Public face: re-exports its parts.

export { ACTOR_ID, CHECK_ID, MAX_NAME } from './domain-parts/shared-ids.js';
export { BONUS_LIMIT, MAX_ACTORS, MAX_BONUSES, MAX_LOG } from './domain-parts/shared-limits.js';
export { isRecord } from './domain-parts/shared-record.js';
export { effective, initialChecks, policyOf, projection } from './domain-parts/policy.js';
export { draftChecks } from './domain-parts/draft.js';
export { bonusKeyOk, validateChecks } from './domain-parts/validate.js';
