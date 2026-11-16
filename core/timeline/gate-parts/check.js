// The guard check itself: the rules hash a state carries and the sentence that says why a guard stays off.

import { HOST_DOMAIN, RULES_DOMAIN } from './domains.js';

const isObject = value => !!value && typeof value === 'object' && !Array.isArray(value);

/** The frozen ruleset's hash the state carries (its `rules` slice), else null. */
export function rulesHashOf(state) {
    const slice = state?.domains?.[RULES_DOMAIN];
    return isObject(slice) && typeof slice.rulesHash === 'string' && slice.rulesHash ? slice.rulesHash : null;
}

/** '' when `guard` may be asked on `state`, else the sentence that says why it stays off. */
export function gateProblem(state, guard) {
    if (!isObject(guard)) return '';
    const domain = state?.domains?.[HOST_DOMAIN];
    // (only what the guard names is compared: a guard without an epoch, or without rules, has nothing to meet there)
    if (isObject(domain) && typeof domain.epoch === 'string' && domain.epoch && guard.epoch !== undefined && guard.epoch !== null && guard.epoch !== domain.epoch) {
        return `it was recorded in epoch ${guard.epoch}, and this timeline is in epoch ${domain.epoch}`;
    }
    const rules = rulesHashOf(state);
    if (guard.rulesHash !== null && guard.rulesHash !== undefined && rules !== null && guard.rulesHash !== rules) {
        return 'it was recorded under other rules than the ones this timeline has frozen';
    }
    return '';
}
