// The job: checking a pack's `requires` (the Story Block range it needs and the capability names it lists).

import { SLUG } from '../limits.js';
import { parseRange, satisfies } from '../version.js';
import { isObject } from '../validate/core.js';

export function checkRequires(requires, { add, hostVersion, capabilities }) {
    const out = { storyBlock: '', capabilities: [] };
    if (!isObject(requires)) {
        add('BAD_REQUIRES', 'requires', 'requires must say which Story Block it needs: { "storyBlock": "^2" }.');
        return out;
    }
    for (const key of Object.keys(requires)) if (key !== 'storyBlock' && key !== 'capabilities') add('UNKNOWN_FIELD', `requires.${key}`, `"${key}" is not a requires field (expected storyBlock, capabilities).`);
    if (typeof requires.storyBlock !== 'string' || !parseRange(requires.storyBlock)) add('BAD_REQUIRES', 'requires.storyBlock', 'requires.storyBlock must be a version range like "^2".');
    else if (!satisfies(hostVersion, requires.storyBlock)) add('HOST_VERSION', 'requires.storyBlock', `This pack needs Story Block ${requires.storyBlock}; this is ${hostVersion}.`);
    else out.storyBlock = requires.storyBlock;
    if (requires.capabilities !== undefined) {
        const list = requires.capabilities;
        if (!Array.isArray(list) || list.some(name => typeof name !== 'string' || !SLUG.test(name))) {
            add('BAD_REQUIRES', 'requires.capabilities', 'requires.capabilities must be a list of names like "inventory" or "party".');
        } else {
            out.capabilities = [...new Set(list)];
            const missing = capabilities ? out.capabilities.filter(name => !capabilities.includes(name)) : [];
            if (missing.length) add('MISSING_CAPABILITY', 'requires.capabilities', `This pack needs ${missing.join(', ')}, which no installed module provides.`);
        }
    }
    return out;
}
