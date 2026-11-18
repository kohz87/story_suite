// The job: checking a pack's `requires` (the suite version it needs and the capability names it lists).

import { SLUG } from '../limits.js';
import { parseRange, satisfies } from '../version.js';
import { isObject } from '../validate/core.js';

// Only `suite` names the version ("^0.1"); `storyBlock`, its older name, is not read.
export function checkRequires(requires, { add, suiteVersion, capabilities }) {
    let range = null, capabilityNames = [];
    if (!isObject(requires)) {
        add('BAD_REQUIRES', 'requires', 'requires must say which suite version it needs: { "suite": "^0.1" }.');
        return { capabilities: [] };
    }
    for (const field of Object.keys(requires)) if (field !== 'suite' && field !== 'storyBlock' && field !== 'capabilities') add('UNKNOWN_FIELD', `requires.${field}`, `"${field}" is not a requires field (expected suite, capabilities).`);
    if (requires.storyBlock !== undefined) add('BAD_REQUIRES', 'requires.storyBlock', 'requires.storyBlock is not read; write requires.suite (like "^0.1").');
    else if (typeof requires.suite !== 'string' || !parseRange(requires.suite)) add('BAD_REQUIRES', 'requires.suite', 'requires.suite must be a version range like "^0.1".');
    else if (!satisfies(suiteVersion, requires.suite)) add('HOST_VERSION', 'requires.suite', `This pack needs Story Suite ${requires.suite}; this is ${suiteVersion}.`);
    else range = requires.suite;
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
    return { ...(range ? { suite: range } : {}), capabilities: capabilityNames };
}
