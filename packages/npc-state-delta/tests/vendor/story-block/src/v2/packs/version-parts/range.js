// Reading a range into comparator checks.

import { compareVersions } from './single.js';
import { tagOf } from './shared-tag.js';

const PART = /^(>=|<=|>|<|=|\^|~)?\s*(\*|x|\d+)(?:\.(\*|x|\d+))?(?:\.(\*|x|\d+))?(?:-([0-9A-Za-z.-]+))?$/i;

const compare = compareVersions;
const wild = part => part === undefined || part === '*' || part.toLowerCase() === 'x';

// One comparator as a list of [operator, version] checks; null when it does not parse.
function comparator(text) {
    const match = PART.exec(text);
    if (!match) return null;
    const [, op = '', a, b, c, tag] = match;
    const raw = [a, b, c];
    if (wild(raw[0])) return op === '' || op === '=' || op === '>=' ? [] : null;
    const nums = raw.map(part => (wild(part) ? null : Number(part)));
    const given = nums.findIndex(n => n === null);
    const depth = given < 0 ? 3 : given;                    // how many parts were written
    // A written tag is that pre-release; a whole version without one is the release; a partial one
    // (or a bound only implied) starts below its pre-releases.
    const pre = tag ? tagOf(tag) : depth === 3 ? null : [];
    const low = [nums[0], nums[1] ?? 0, nums[2] ?? 0, pre];
    const floor = [low[0], low[1], low[2], tag ? pre : []];
    const bump = index => {                                  // the first version past `index`, below its pre-releases
        const next = [low[0], low[1], low[2], []];
        next[index] += 1;
        for (let i = index + 1; i < 3; i += 1) next[i] = 0;
        return next;
    };
    if (op === '^') {
        const first = low[0] > 0 || depth === 1 ? 0 : low[1] > 0 || depth === 2 ? 1 : 2;
        return [['>=', floor], ['<', bump(first)]];
    }
    if (op === '~') return [['>=', floor], ['<', bump(depth === 1 ? 0 : 1)]];
    if (op === '' || op === '=') return depth === 3 ? [['=', low]] : [['>=', floor], ['<', bump(depth - 1)]];
    if (op === '>') return depth === 3 ? [['>', low]] : [['>=', bump(depth - 1)]];
    if (op === '<=') return depth === 3 ? [['<=', low]] : [['<', bump(depth - 1)]];
    return [[op, low]];
}

/** The range as alternatives of checks; null when any part does not parse. */
export function parseRange(range) {
    const text = String(range ?? '').trim();
    if (!text || text.length > 100) return null;
    const alternatives = [];
    for (const alternative of text.split('||')) {
        const parts = alternative.trim().replace(/(>=|<=|>|<|=|\^|~)\s+/g, '$1').split(/\s+/).filter(Boolean);
        if (!parts.length) return null;
        const checks = [];
        for (const part of parts) {
            const parsed = comparator(part);
            if (!parsed) return null;
            checks.push(...parsed);
        }
        alternatives.push(checks);
    }
    return alternatives;
}
