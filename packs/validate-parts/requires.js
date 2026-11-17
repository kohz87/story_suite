// The job: checking a pack's `requires` (the suite version it needs and the capability names it lists).

import { SLUG } from '../limits.js';
import { parseRange, satisfies } from '../version.js';
import { isObject } from '../validate/core.js';

// `suite` is the range of the suite's own version ("^0.1"). `storyBlock` is the older word: its range holds when it fits either the host
// compatibility number older packs name (`hostVersion`) or the suite version, so a pack written for either keeps loading.
export function checkRequires(requires, { add, hostVersion, suiteVersion, capabilities }) {
    let range = null, key = null, capabilityNames = [];
    if (!isObject(requires)) {
        add('BAD_REQUIRES', 'requires', 'requires must say which suite version it needs: { "suite": "^0.1" }.');
        return { capabilities: [] };
    }
    for (const field of Object.keys(requires)) if (field !== 'suite' && field !== 'storyBlock' && field !== 'capabilities') add('UNKNOWN_FIELD', `requires.${field}`, `"${field}" is not a requires field (expected suite, capabilities).`);
    if (requires.suite !== undefined && requires.storyBlock !== undefined) add('BAD_REQUIRES', 'requires.storyBlock', 'requires has both suite and storyBlock (its older name); keep suite.');
    else {
        const name = requires.suite !== undefined ? 'suite' : 'storyBlock', given = requires[name];
        if (typeof given !== 'string' || !parseRange(given)) add('BAD_REQUIRES', `requires.${name}`, `requires.${name} must be a version range like "^0.1".`);
        else if (name === 'suite' ? !satisfies(suiteVersion, given) : !satisfies(hostVersion, given) && !satisfies(suiteVersion, given)) add('HOST_VERSION', `requires.${name}`, `This pack needs Story Suite ${given}; this is ${suiteVersion}.`);
        else { key = name; range = given; }
    }
    if (requires.capabilities !== undefined) {
        const list = requires.capabilities;
        if (!Array.isArray(list) || list.some(name => typeof name !== 'string' || !SLUG.test(name))) {
            add('BAD_REQUIRES', 'requires.capabilities', 'requires.capabilities must be a list of names like "inventory" or "party".');
        } else {
            capabilityNames = [...new Set(list)];
            const missing = capabilities ? capabilityNames.filter(name => !capabilities.includes(name)) : [];
            if (missing.length) add('MISSING_CAPABILITY', 'requires.capabilities', `This pack needs ${missing.join(', ')}, which no installed module provides.`);
        }
    }
    return { ...(key ? { [key]: range } : {}), capabilities: capabilityNames };
}
